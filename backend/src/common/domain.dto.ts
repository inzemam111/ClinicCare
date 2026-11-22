import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AppointmentStatus,
  DocumentType,
  NotificationChannel,
  PaymentMethod,
} from '@prisma/client';
import { PaginationQueryDto } from './pagination.dto';

export class PatientCreateDto {
  @ApiProperty() @IsString() @Length(1, 80) firstName!: string;
  @ApiProperty() @IsString() @Length(1, 80) lastName!: string;
  @ApiProperty({ format: 'date' }) @IsDateString() dateOfBirth!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) bloodGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) allergies?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) medicalConditions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) currentMedication?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) emergencyContactPhone?: string;
}

export class PatientUpdateDto extends PartialType(PatientCreateDto) {}

export class PatientListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['firstName', 'lastName', 'createdAt'] })
  @IsOptional()
  @IsIn(['firstName', 'lastName', 'createdAt'])
  sortBy: 'firstName' | 'lastName' | 'createdAt' = 'createdAt';
  @ApiPropertyOptional({ enum: ['all', 'new', 'returning', 'follow-up-due', 'payment-pending'] })
  @IsOptional()
  @IsIn(['all', 'new', 'returning', 'follow-up-due', 'payment-pending'])
  filter: 'all' | 'new' | 'returning' | 'follow-up-due' | 'payment-pending' = 'all';
}

export class PatientMergeDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() sourcePatientId!: string;
  @ApiPropertyOptional({ description: 'Explicit confirmation for the controlled merge' })
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class DoctorUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) specialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  clinicHoursStart?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  clinicHoursEnd?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) breakStart?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) breakEnd?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  consultationDuration?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  followUpDuration?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  dailyMaxAppointments?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  appointmentFee?: number;
}

export class DoctorCreateDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 12 }) @IsString() @Length(12, 128) password!: string;
  @ApiProperty() @IsString() @Length(1, 120) displayName!: string;
  @ApiProperty() @IsString() @Length(1, 100) registrationNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) specialty?: string;
}

export class DoctorScheduleCreateDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;
  @ApiProperty({ example: '09:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @ApiProperty({ example: '17:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @ApiProperty({ minimum: 5, maximum: 240, default: 15 })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  slotMinutes = 15;
  @ApiProperty({ format: 'date' }) @IsDateString() effectiveFrom!: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() effectiveTo?: string;
}

export class DoctorListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['createdAt', 'specialty'] })
  @IsOptional()
  @IsIn(['createdAt', 'specialty'])
  sortBy: 'createdAt' | 'specialty' = 'createdAt';
}

export class ClinicCreateDto {
  @ApiProperty() @IsString() @Length(2, 120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) timezone?: string;
}

export class ClinicUpdateDto extends PartialType(ClinicCreateDto) {}

export class ClinicListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['name', 'createdAt'] })
  @IsOptional()
  @IsIn(['name', 'createdAt'])
  sortBy: 'name' | 'createdAt' = 'name';
}

export class StaffUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StaffPermissionsUpdateDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

export class StaffCreateDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 12 }) @IsString() @Length(12, 128) password!: string;
  @ApiProperty() @IsString() @Length(1, 120) displayName!: string;
}

export class StaffListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['title', 'createdAt'] })
  @IsOptional()
  @IsIn(['title', 'createdAt'])
  sortBy: 'title' | 'createdAt' = 'createdAt';
}

export class HolidayCreateDto {
  @ApiProperty({ format: 'date' }) @IsDateString() date!: string;
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
}

export class AppointmentCreateDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiProperty() @IsUUID() doctorId!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() startsAt!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() endsAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isWalkIn?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  tokenNumber?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee?: number;
}

export class AppointmentUpdateDto {
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() endsAt?: string;
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  tokenNumber?: number;
}

export class AppointmentListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() patientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() doctorId?: string;
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
}

export class AvailabilityQueryDto {
  @ApiProperty() @IsUUID() doctorId!: string;
  @ApiProperty({ format: 'date' }) @IsDateString() date!: string;
}

export class ConsultationCreateDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() appointmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) clinicalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) symptoms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) examination?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) treatmentPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() followUpAt?: string;
}

export class ConsultationUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) clinicalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) symptoms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) examination?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) treatmentPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() followUpAt?: string;
}

export class VitalRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(300)
  systolic?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(200)
  diastolic?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(300)
  pulse?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(45)
  temperature?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(300)
  heightCm?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(500)
  weightKg?: number;
}

export class DiagnosisDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) code?: string;
  @ApiProperty() @IsString() @Length(1, 1000) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class ClinicalTemplateDto {
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) specialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) symptoms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) examination?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) treatmentPlan?: string;
}

export class ConsultationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() patientId?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
}

export class MedicalRecordCreateDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() consultationId?: string;
  @ApiProperty({ enum: DocumentType }) @IsEnum(DocumentType) type!: DocumentType;
  @ApiProperty() @IsString() @Length(1, 200) title!: string;
  @ApiProperty({ description: 'Opaque key returned by the trusted file-storage service' })
  @IsString()
  @Length(1, 500)
  @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/)
  storageKey!: string;
}

export class MedicalRecordListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() patientId?: string;
  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;
}

export class FamilyMemberCreateDto {
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
  @ApiProperty() @IsString() @Length(1, 80) relationship!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export class ConsentCreateDto {
  @ApiProperty() @IsString() @Length(1, 120) consentType!: string;
  @ApiProperty() @IsString() @Length(1, 80) version!: string;
}

export class PrescriptionItemDto {
  @ApiProperty() @IsString() @Length(1, 200) medicineName!: string;
  @ApiProperty() @IsString() @Length(1, 120) dosage!: string;
  @ApiProperty() @IsString() @Length(1, 120) frequency!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) genericName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) brandName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) strength?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) foodInstructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) specialInstructions?: string;
}

export class PrescriptionCreateDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiProperty() @IsUUID() consultationId!: string;
  @ApiProperty({ type: [PrescriptionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) diagnosis?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  investigationRecommendations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) followUpInstructions?: string;
}

export class PrescriptionCorrectionDto extends PrescriptionCreateDto {
  @ApiProperty() @IsString() @Length(5, 1000) correctionReason!: string;
}

export class PrescriptionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() patientId?: string;
}

export class FinanceEntryCreateDto {
  @ApiProperty({ minimum: 0.01, maximum: 1000000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000000)
  amount!: number;
  @ApiProperty() @IsString() @Length(1, 80) category!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() occurredAt!: string;
}

export const incomeCategories = [
  'NEW_CONSULTATION',
  'FOLLOW_UP',
  'ONLINE_CONSULTATION',
  'PROCEDURE',
  'OTHER_SERVICES',
] as const;

export const expenseCategories = [
  'RENT',
  'ELECTRICITY',
  'STAFF_SALARY',
  'INTERNET',
  'MEDICAL_SUPPLIES',
  'EQUIPMENT',
  'MAINTENANCE',
  'MARKETING',
  'OTHER',
] as const;

export class PaymentCreateDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() patientId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() appointmentId?: string;
  @ApiProperty({ minimum: 0.01, maximum: 1000000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000000)
  amount!: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method!: PaymentMethod;
  @ApiProperty({ enum: incomeCategories })
  @IsIn(incomeCategories)
  serviceCategory!: (typeof incomeCategories)[number];
  @ApiProperty({ description: 'Client-generated idempotency key (UUID)' })
  @IsUUID()
  idempotencyKey!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class PaymentVerifyDto {
  @ApiPropertyOptional({ description: 'Gateway transaction reference; optional for cash' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerTransactionId?: string;
}

export class RefundCreateDto {
  @ApiProperty({ minimum: 0.01, maximum: 1000000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000000)
  amount!: number;
  @ApiProperty() @IsString() @Length(3, 500) reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) providerRefundId?: string;
}

export class ExpenseCreateDto extends FinanceEntryCreateDto {
  @ApiProperty({ enum: expenseCategories })
  @IsIn(expenseCategories)
  declare category: (typeof expenseCategories)[number];
  @ApiProperty() @IsString() @Length(1, 500) description!: string;
}

export class ExpenseCorrectionDto extends ExpenseCreateDto {
  @ApiProperty() @IsString() @Length(5, 1000) correctionReason!: string;
}

export class FinanceSummaryQueryDto {
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
}

export class FinanceReportQueryDto extends FinanceSummaryQueryDto {
  @ApiPropertyOptional({
    enum: [
      'DATE_WISE_COLLECTIONS',
      'MONTHLY_STATEMENT',
      'EXPENSES',
      'OUTSTANDING',
      'REFUNDS',
      'SERVICE_REVENUE',
    ],
  })
  @IsOptional()
  @IsIn([
    'DATE_WISE_COLLECTIONS',
    'MONTHLY_STATEMENT',
    'EXPENSES',
    'OUTSTANDING',
    'REFUNDS',
    'SERVICE_REVENUE',
  ])
  reportType:
    | 'DATE_WISE_COLLECTIONS'
    | 'MONTHLY_STATEMENT'
    | 'EXPENSES'
    | 'OUTSTANDING'
    | 'REFUNDS'
    | 'SERVICE_REVENUE' = 'DATE_WISE_COLLECTIONS';
}

export class NotificationCreateDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clinicId?: string;
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @ApiProperty() @IsString() @Length(1, 5000) body!: string;
}

export class NotificationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  unreadOnly?: string;
}

export class UsersListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['displayName', 'email', 'createdAt']) sortBy:
    'displayName' | 'email' | 'createdAt' = 'createdAt';
}

export class UserUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}

export class DateRangeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() clinicId?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) entityType?: string;
}
