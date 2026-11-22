import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import {
  DateRangeQueryDto,
  ExpenseCorrectionDto,
  ExpenseCreateDto,
  FinanceReportQueryDto,
  FinanceSummaryQueryDto,
  PaymentCreateDto,
  PaymentVerifyDto,
  RefundCreateDto,
} from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

type ReportValue = string | number;
type FinancialReport = {
  title: string;
  columns: string[];
  rows: Array<Record<string, ReportValue>>;
};
type BinaryResponse = { setHeader(name: string, value: string): void; send(content: Buffer): void };
const completedStatuses = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

function rangeFilter(from?: string, to?: string): Prisma.DateTimeFilter {
  if (from && to && new Date(from) >= new Date(to))
    throw new BadRequestException('from must be earlier than to');
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) };
}
function sum(values: Array<Prisma.Decimal | number | null | undefined>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(value ?? 0),
    new Prisma.Decimal(0),
  );
}
function money(value: Prisma.Decimal | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}
function csvCell(value: ReportValue): string {
  const rendered = String(value);
  return /[",\r\n]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}
function minimalPdf(title: string, report: FinancialReport): Buffer {
  const escape = (value: string) =>
    value.replace(/([\\()])/g, '\\$1').replace(/[^\x20-\x7E]/g, '?');
  const lines = [
    title,
    report.columns.join(' | '),
    ...report.rows.map((row) => report.columns.map((column) => row[column] ?? '').join(' | ')),
  ]
    .slice(0, 48)
    .map(escape);
  const content = `BT\n/F1 10 Tf\n36 806 Td\n${lines.map((line, index) => `${index ? '0 -14 Td\n' : ''}(${line}) Tj`).join('\n')}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'utf8');
}

@Injectable()
class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}
  private assertAnalytics(actor: AuthenticatedUser) {
    this.authorization.assertPermissions(actor, [Permissions.FINANCE_ANALYTICS]);
  }
  private async assertPaymentScope(
    actor: AuthenticatedUser,
    clinicId: string,
    patientId?: string,
    appointmentId?: string,
  ): Promise<void> {
    if (
      patientId &&
      !(await this.prisma.patient.findFirst({
        where: {
          id: patientId,
          clinicId,
          deletedAt: null,
          ...(actor.roles.includes('PATIENT') ? { userId: actor.id } : {}),
        },
        select: { id: true },
      }))
    ) {
      if (actor.roles.includes('PATIENT'))
        throw new ForbiddenException('Patient payment scope violation');
      throw new NotFoundException('Patient not found');
    }
    if (actor.roles.includes('PATIENT') && !patientId)
      throw new BadRequestException('Patients must provide their own patient ID');
    if (appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: appointmentId, clinicId },
        select: { patientId: true, patient: { select: { userId: true } } },
      });
      if (!appointment) throw new NotFoundException('Appointment not found');
      if (patientId && appointment.patientId !== patientId)
        throw new BadRequestException('The appointment does not belong to the supplied patient');
      if (actor.roles.includes('PATIENT') && appointment.patient.userId !== actor.id)
        throw new ForbiddenException('Patient payment scope violation');
    }
  }
  async recordPayment(actor: AuthenticatedUser, input: PaymentCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.PAYMENT_RECORD]);
    const clinicId = requireClinicId(actor);
    await this.assertPaymentScope(actor, clinicId, input.patientId, input.appointmentId);
    const existing = await this.prisma.payment.findFirst({
      where: { clinicId, idempotencyKey: input.idempotencyKey },
      select: { id: true, status: true, amount: true },
    });
    if (existing) return { ...existing, idempotent: true };
    return this.prisma.$transaction(
      async (transaction) => {
        const payment = await transaction.payment.create({
          data: {
            clinicId,
            patientId: input.patientId,
            appointmentId: input.appointmentId,
            amount: new Prisma.Decimal(input.amount),
            method: input.method,
            provider: input.method,
            serviceCategory: input.serviceCategory,
            idempotencyKey: input.idempotencyKey,
            note: input.note,
          },
        });
        await transaction.auditLog.create({
          data: {
            clinicId,
            actorId: actor.id,
            action: 'PAYMENT_RECORDED_PENDING_VERIFICATION',
            entityType: 'payments',
            entityId: payment.id,
            after: {
              amount: input.amount,
              method: input.method,
              serviceCategory: input.serviceCategory,
            },
          },
        });
        return payment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async verifyPayment(actor: AuthenticatedUser, id: string, input: PaymentVerifyDto) {
    this.authorization.assertPermissions(actor, [Permissions.PAYMENT_RECORD]);
    const clinicId = requireClinicId(actor);
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const payment = await transaction.payment.findFirst({
          where: { id, clinicId },
          select: {
            id: true,
            status: true,
            amount: true,
            method: true,
            serviceCategory: true,
            patient: { select: { userId: true } },
          },
        });
        if (!payment) throw new NotFoundException('Payment not found');
        if (actor.roles.includes('PATIENT') && payment.patient?.userId !== actor.id)
          throw new ForbiddenException('Patient payment scope violation');
        if (payment.status !== PaymentStatus.PENDING)
          throw new BadRequestException('Only pending payments can be verified');
        if (
          payment.method !== PaymentMethod.CASH &&
          process.env.PAYMENT_VERIFICATION_MODE !== 'sandbox'
        )
          throw new BadRequestException(
            'Electronic payments require a configured provider verification integration',
          );
        const providerTransactionId =
          input.providerTransactionId ??
          (payment.method === PaymentMethod.CASH ? `CASH-${payment.id}` : undefined);
        if (!providerTransactionId)
          throw new BadRequestException('A verified gateway transaction reference is required');
        const verifiedAt = new Date();
        const updated = await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
            verifiedAt,
            verifiedById: actor.id,
            providerTransactionId,
          },
        });
        const income = await transaction.incomeEntry.create({
          data: {
            clinicId,
            paymentId: payment.id,
            amount: payment.amount,
            category: payment.serviceCategory,
            occurredAt: verifiedAt,
          },
        });
        const receipt = await transaction.receipt.create({
          data: {
            clinicId,
            paymentId: payment.id,
            receiptNumber: `RCPT-${verifiedAt.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            issuedAt: verifiedAt,
          },
        });
        await transaction.auditLog.create({
          data: {
            clinicId,
            actorId: actor.id,
            action: 'PAYMENT_VERIFIED',
            entityType: 'payments',
            entityId: payment.id,
            before: { status: payment.status },
            after: {
              status: PaymentStatus.SUCCEEDED,
              incomeEntryId: income.id,
              receiptId: receipt.id,
            },
          },
        });
        return { payment: updated, income, receipt };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async refund(actor: AuthenticatedUser, id: string, input: RefundCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.FINANCE_WRITE]);
    const clinicId = requireClinicId(actor);
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const payment = await transaction.payment.findFirst({
          where: { id, clinicId },
          include: { refunds: { select: { amount: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');
        if (
          payment.status !== PaymentStatus.SUCCEEDED &&
          payment.status !== PaymentStatus.PARTIALLY_REFUNDED
        )
          throw new BadRequestException('Only verified collections can be refunded');
        const previousRefunds = sum(payment.refunds.map((refund) => refund.amount));
        const refundAmount = new Prisma.Decimal(input.amount);
        if (previousRefunds.plus(refundAmount).greaterThan(payment.amount))
          throw new BadRequestException('Refund amount exceeds the verified collection');
        const refund = await transaction.refund.create({
          data: {
            paymentId: payment.id,
            amount: refundAmount,
            reason: input.reason,
            providerRefundId: input.providerRefundId ?? `REF-${randomUUID()}`,
            processedById: actor.id,
          },
        });
        const totalRefunded = previousRefunds.plus(refundAmount);
        const status = totalRefunded.equals(payment.amount)
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
        await transaction.payment.update({ where: { id: payment.id }, data: { status } });
        await transaction.auditLog.create({
          data: {
            clinicId,
            actorId: actor.id,
            action: 'PAYMENT_REFUNDED',
            entityType: 'payments',
            entityId: payment.id,
            before: { status: payment.status, refunded: money(previousRefunds) },
            after: { status, refundId: refund.id, refunded: money(totalRefunded) },
          },
        });
        return refund;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async listPayments(actor: AuthenticatedUser, query: DateRangeQueryDto) {
    this.assertAnalytics(actor);
    const clinicId = requireClinicId(actor);
    const where: Prisma.PaymentWhereInput = {
      clinicId,
      ...(query.from || query.to ? { createdAt: rangeFilter(query.from, query.to) } : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.payment.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: sortDirection(query.sortOrder) },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            refunds: true,
            receipt: true,
          },
        }),
      () => this.prisma.payment.count({ where }),
    );
  }
  async listMyPayments(actor: AuthenticatedUser, query: DateRangeQueryDto) {
    this.authorization.assertPermissions(actor, [Permissions.PAYMENT_RECORD]);
    if (!actor.roles.includes('PATIENT')) throw new ForbiddenException('Patient access required');
    const clinicId = requireClinicId(actor);
    return this.prisma.payment.findMany({
      where: {
        clinicId,
        patient: { userId: actor.id },
        createdAt: rangeFilter(query.from, query.to),
      },
      orderBy: { createdAt: 'desc' },
      include: { receipt: true, appointment: { select: { id: true, startsAt: true } } },
    });
  }
  async listIncome(actor: AuthenticatedUser, query: DateRangeQueryDto) {
    this.assertAnalytics(actor);
    const clinicId = requireClinicId(actor);
    const where: Prisma.IncomeEntryWhereInput = {
      clinicId,
      payment: { status: { in: completedStatuses }, verifiedAt: { not: null } },
      ...(query.from || query.to ? { occurredAt: rangeFilter(query.from, query.to) } : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.incomeEntry.findMany({
          where,
          skip,
          take,
          orderBy: { occurredAt: sortDirection(query.sortOrder) },
          include: { payment: true },
        }),
      () => this.prisma.incomeEntry.count({ where }),
    );
  }
  async listExpenses(actor: AuthenticatedUser, query: DateRangeQueryDto) {
    this.authorization.assertPermissions(actor, [Permissions.EXPENSE_READ]);
    const clinicId = requireClinicId(actor);
    const where: Prisma.ExpenseWhereInput = {
      clinicId,
      isCurrent: true,
      ...(query.from || query.to ? { occurredAt: rangeFilter(query.from, query.to) } : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.expense.findMany({
          where,
          skip,
          take,
          orderBy: { occurredAt: sortDirection(query.sortOrder) },
          include: { category: true },
        }),
      () => this.prisma.expense.count({ where }),
    );
  }
  async createExpense(actor: AuthenticatedUser, input: ExpenseCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.FINANCE_WRITE]);
    const clinicId = requireClinicId(actor);
    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.expenseCategory.upsert({
        where: { clinicId_name: { clinicId, name: input.category } },
        update: {},
        create: { clinicId, name: input.category },
      });
      const expense = await transaction.expense.create({
        data: {
          clinicId,
          categoryId: category.id,
          amount: new Prisma.Decimal(input.amount),
          occurredAt: new Date(input.occurredAt),
          description: input.description,
        },
        include: { category: true },
      });
      await transaction.auditLog.create({
        data: {
          clinicId,
          actorId: actor.id,
          action: 'EXPENSE_RECORDED',
          entityType: 'expenses',
          entityId: expense.id,
          after: { amount: input.amount, category: input.category },
        },
      });
      return expense;
    });
  }
  async correctExpense(actor: AuthenticatedUser, id: string, input: ExpenseCorrectionDto) {
    this.authorization.assertPermissions(actor, [Permissions.FINANCE_WRITE]);
    const clinicId = requireClinicId(actor);
    return this.prisma.$transaction(
      async (transaction) => {
        const previous = await transaction.expense.findFirst({
          where: { id, clinicId, isCurrent: true },
          include: { category: true },
        });
        if (!previous) throw new NotFoundException('Current expense not found');
        const category = await transaction.expenseCategory.upsert({
          where: { clinicId_name: { clinicId, name: input.category } },
          update: {},
          create: { clinicId, name: input.category },
        });
        await transaction.expense.update({
          where: { id: previous.id },
          data: { isCurrent: false },
        });
        const corrected = await transaction.expense.create({
          data: {
            clinicId,
            categoryId: category.id,
            amount: new Prisma.Decimal(input.amount),
            occurredAt: new Date(input.occurredAt),
            description: input.description,
            previousVersionId: previous.id,
            correctionReason: input.correctionReason,
          },
          include: { category: true },
        });
        await transaction.auditLog.create({
          data: {
            clinicId,
            actorId: actor.id,
            action: 'EXPENSE_CORRECTED',
            entityType: 'expenses',
            entityId: corrected.id,
            before: { expenseId: previous.id, amount: money(previous.amount) },
            after: {
              expenseId: corrected.id,
              amount: input.amount,
              correctionReason: input.correctionReason,
            },
          },
        });
        return corrected;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private async financialData(clinicId: string, from?: string, to?: string) {
    const [payments, expenses, pending] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          clinicId,
          verifiedAt: { not: null, ...rangeFilter(from, to) },
          status: { in: completedStatuses },
        },
        include: {
          refunds: true,
          patient: { select: { firstName: true, lastName: true, medicalRecordNumber: true } },
        },
        orderBy: { verifiedAt: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: { clinicId, isCurrent: true, occurredAt: rangeFilter(from, to) },
        include: { category: true },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { clinicId, status: PaymentStatus.PENDING },
        include: {
          patient: { select: { firstName: true, lastName: true, medicalRecordNumber: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { payments, expenses, pending };
  }
  async dashboard(actor: AuthenticatedUser, query: FinanceSummaryQueryDto) {
    this.assertAnalytics(actor);
    const clinicId = requireClinicId(actor);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const { payments, expenses, pending } = await this.financialData(
      clinicId,
      query.from ?? startOfYear.toISOString(),
      query.to,
    );
    const refunds = payments.flatMap((payment) => payment.refunds);
    const gross = sum(payments.map((payment) => payment.amount));
    const refundTotal = sum(refunds.map((refund) => refund.amount));
    const expenseTotal = sum(expenses.map((expense) => expense.amount));
    const daily = sum(
      payments
        .filter((payment) => payment.verifiedAt && payment.verifiedAt >= startOfToday)
        .map((payment) => payment.amount),
    );
    const monthly = sum(
      payments
        .filter((payment) => payment.verifiedAt && payment.verifiedAt >= startOfMonth)
        .map((payment) => payment.amount),
    );
    const yearly = sum(payments.map((payment) => payment.amount));
    const receivable = sum(pending.map((payment) => payment.amount));
    const netCollections = gross.minus(refundTotal);
    const monthlySeries = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), index, 1);
      const next = new Date(now.getFullYear(), index + 1, 1);
      const bucketPayments = payments.filter(
        (payment) => payment.verifiedAt && payment.verifiedAt >= date && payment.verifiedAt < next,
      );
      const bucketRefunds = bucketPayments
        .flatMap((payment) => payment.refunds)
        .filter((refund) => refund.createdAt >= date && refund.createdAt < next);
      const bucketExpenses = expenses.filter(
        (expense) => expense.occurredAt >= date && expense.occurredAt < next,
      );
      const income = sum(bucketPayments.map((payment) => payment.amount));
      const bucketRefundTotal = sum(bucketRefunds.map((refund) => refund.amount));
      return {
        period: date.toISOString().slice(0, 7),
        income: money(income),
        refunds: money(bucketRefundTotal),
        expenses: money(sum(bucketExpenses.map((expense) => expense.amount))),
        net: money(income.minus(bucketRefundTotal)),
      };
    });
    const expenseCategoryBreakdown = [
      ...new Set(expenses.map((expense) => expense.category?.name ?? 'UNCATEGORISED')),
    ].map((category) => ({
      category,
      amount: money(
        sum(
          expenses
            .filter((expense) => (expense.category?.name ?? 'UNCATEGORISED') === category)
            .map((expense) => expense.amount),
        ),
      ),
    }));
    const paymentMethodBreakdown = Object.values(PaymentMethod).map((method) => ({
      method,
      amount: money(
        sum(
          payments.filter((payment) => payment.method === method).map((payment) => payment.amount),
        ),
      ),
    }));
    const dailyIncome = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29 + index);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return {
        period: date.toISOString().slice(0, 10),
        amount: money(
          sum(
            payments
              .filter(
                (payment) =>
                  payment.verifiedAt && payment.verifiedAt >= date && payment.verifiedAt < next,
              )
              .map((payment) => payment.amount),
          ),
        ),
      };
    });
    return {
      period: { from: query.from ?? startOfYear.toISOString(), to: query.to ?? null },
      metrics: {
        todaysIncome: money(daily),
        monthlyIncome: money(monthly),
        annualIncome: money(yearly),
        totalExpenses: money(expenseTotal),
        netCollections: money(netCollections),
        pendingReceivables: money(receivable),
        refunds: money(refundTotal),
        netOperatingSurplus: money(netCollections.minus(expenseTotal)),
      },
      charts: {
        dailyIncome,
        monthlyIncome: monthlySeries.map(({ period, income }) => ({ period, amount: income })),
        yearlyIncome: [{ year: now.getFullYear(), amount: money(yearly) }],
        expenseCategoryBreakdown,
        incomeVsExpenses: monthlySeries,
        paymentMethodBreakdown,
      },
    };
  }
  async report(actor: AuthenticatedUser, query: FinanceReportQueryDto): Promise<FinancialReport> {
    this.assertAnalytics(actor);
    const { payments, expenses, pending } = await this.financialData(
      requireClinicId(actor),
      query.from,
      query.to,
    );
    if (query.reportType === 'EXPENSES')
      return {
        title: 'Expense report',
        columns: ['date', 'category', 'description', 'amount'],
        rows: expenses.map((expense) => ({
          date: expense.occurredAt.toISOString().slice(0, 10),
          category: expense.category?.name ?? 'UNCATEGORISED',
          description: expense.description,
          amount: money(expense.amount),
        })),
      };
    if (query.reportType === 'OUTSTANDING')
      return {
        title: 'Outstanding payment report',
        columns: ['createdAt', 'patient', 'amount', 'method', 'serviceCategory'],
        rows: pending.map((payment) => ({
          createdAt: payment.createdAt.toISOString(),
          patient: payment.patient
            ? `${payment.patient.firstName} ${payment.patient.lastName}`
            : 'Walk-in',
          amount: money(payment.amount),
          method: payment.method,
          serviceCategory: payment.serviceCategory,
        })),
      };
    if (query.reportType === 'REFUNDS')
      return {
        title: 'Refund report',
        columns: ['date', 'paymentId', 'amount', 'reason'],
        rows: payments.flatMap((payment) =>
          payment.refunds.map((refund) => ({
            date: refund.createdAt.toISOString(),
            paymentId: payment.id,
            amount: money(refund.amount),
            reason: refund.reason ?? '',
          })),
        ),
      };
    if (query.reportType === 'SERVICE_REVENUE') {
      const categories = [...new Set(payments.map((payment) => payment.serviceCategory))];
      return {
        title: 'Service-wise revenue',
        columns: ['serviceCategory', 'verifiedCollections', 'refunds', 'netCollections'],
        rows: categories.map((category) => {
          const matched = payments.filter((payment) => payment.serviceCategory === category);
          const collections = sum(matched.map((payment) => payment.amount));
          const refunds = sum(
            matched.flatMap((payment) => payment.refunds).map((refund) => refund.amount),
          );
          return {
            serviceCategory: category,
            verifiedCollections: money(collections),
            refunds: money(refunds),
            netCollections: money(collections.minus(refunds)),
          };
        }),
      };
    }
    if (query.reportType === 'MONTHLY_STATEMENT') {
      const groups = new Map<string, typeof payments>();
      payments.forEach((payment) => {
        const key = payment.verifiedAt!.toISOString().slice(0, 7);
        groups.set(key, [...(groups.get(key) ?? []), payment]);
      });
      return {
        title: 'Monthly financial statement',
        columns: ['month', 'verifiedCollections', 'refunds', 'expenses', 'netOperatingSurplus'],
        rows: [...groups.entries()].map(([month, matched]) => {
          const collections = sum(matched.map((payment) => payment.amount));
          const refunds = sum(
            matched.flatMap((payment) => payment.refunds).map((refund) => refund.amount),
          );
          const costs = sum(
            expenses
              .filter((expense) => expense.occurredAt.toISOString().slice(0, 7) === month)
              .map((expense) => expense.amount),
          );
          return {
            month,
            verifiedCollections: money(collections),
            refunds: money(refunds),
            expenses: money(costs),
            netOperatingSurplus: money(collections.minus(refunds).minus(costs)),
          };
        }),
      };
    }
    return {
      title: 'Date-wise collections',
      columns: ['date', 'verifiedCollections', 'refunds', 'netCollections'],
      rows: payments.map((payment) => {
        const refunded = sum(payment.refunds.map((refund) => refund.amount));
        return {
          date: payment.verifiedAt!.toISOString(),
          verifiedCollections: money(payment.amount),
          refunds: money(refunded),
          netCollections: money(payment.amount.minus(refunded)),
        };
      }),
    };
  }
  async exportReport(
    actor: AuthenticatedUser,
    query: FinanceReportQueryDto,
    format: 'csv' | 'pdf',
  ) {
    const report = await this.report(actor, query);
    const stem = report.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (format === 'pdf')
      return {
        filename: `${stem}.pdf`,
        contentType: 'application/pdf',
        content: minimalPdf(report.title, report),
      };
    return {
      filename: `${stem}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: Buffer.from(
        [
          report.columns.join(','),
          ...report.rows.map((row) =>
            report.columns.map((column) => csvCell(row[column] ?? '')).join(','),
          ),
        ].join('\r\n'),
        'utf8',
      ),
    };
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
class PaymentsController {
  constructor(private readonly finance: FinanceService) {}
  @Post() @RequirePermissions(Permissions.PAYMENT_RECORD) record(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: PaymentCreateDto,
  ) {
    return this.finance.recordPayment(actor, input);
  }
  @Post(':id/verify') @RequirePermissions(Permissions.PAYMENT_RECORD) verify(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PaymentVerifyDto,
  ) {
    return this.finance.verifyPayment(actor, id, input);
  }
  @Post(':id/refunds') @RequirePermissions(Permissions.FINANCE_WRITE) refund(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RefundCreateDto,
  ) {
    return this.finance.refund(actor, id, input);
  }
  @Get('mine') @RequirePermissions(Permissions.PAYMENT_RECORD) mine(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.finance.listMyPayments(actor, query);
  }
  @Get() @RequirePermissions(Permissions.FINANCE_ANALYTICS) list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.finance.listPayments(actor, query);
  }
}
@ApiTags('Finance')
@ApiBearerAuth()
@Controller('income')
class IncomeController {
  constructor(private readonly finance: FinanceService) {}
  @Post() @RequirePermissions(Permissions.PAYMENT_RECORD) create() {
    throw new BadRequestException(
      'Record and verify a payment; raw income entries are not accepted',
    );
  }
  @Get() @RequirePermissions(Permissions.FINANCE_ANALYTICS) list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.finance.listIncome(actor, query);
  }
}
@ApiTags('Finance')
@ApiBearerAuth()
@Controller('expenses')
class ExpensesController {
  constructor(private readonly finance: FinanceService) {}
  @Post() @RequirePermissions(Permissions.FINANCE_WRITE) create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: ExpenseCreateDto,
  ) {
    return this.finance.createExpense(actor, input);
  }
  @Post(':id/correct') @RequirePermissions(Permissions.FINANCE_WRITE) correct(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ExpenseCorrectionDto,
  ) {
    return this.finance.correctExpense(actor, id, input);
  }
  @Get() @RequirePermissions(Permissions.EXPENSE_READ) list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.finance.listExpenses(actor, query);
  }
}
@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('summary')
  @RequirePermissions(Permissions.FINANCE_ANALYTICS)
  @ApiOperation({ summary: 'Server-side clinic accounting dashboard and chart series' })
  summary(@CurrentUser() actor: AuthenticatedUser, @Query() query: FinanceSummaryQueryDto) {
    return this.finance.dashboard(actor, query);
  }
  @Get('reports') @RequirePermissions(Permissions.FINANCE_ANALYTICS) report(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: FinanceReportQueryDto,
  ) {
    return this.finance.report(actor, query);
  }
  @Get('reports/export') @RequirePermissions(Permissions.FINANCE_ANALYTICS) async export(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: FinanceReportQueryDto,
    @Query('format') format: 'csv' | 'pdf',
    @Res() response: BinaryResponse,
  ) {
    if (format !== 'csv' && format !== 'pdf')
      throw new BadRequestException('format must be csv or pdf');
    const result = await this.finance.exportReport(actor, query, format);
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.send(result.content);
  }
}
@Module({
  imports: [AuthorizationModule],
  controllers: [PaymentsController, IncomeController, ExpensesController, FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
