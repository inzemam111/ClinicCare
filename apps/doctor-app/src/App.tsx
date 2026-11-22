import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import SvgModule, {
  Circle as CircleModule,
  Path as PathModule,
  Rect as RectModule,
} from 'react-native-svg';

const Svg = SvgModule as unknown as (props: Record<string, unknown>) => ReactNode;
const Circle = CircleModule as unknown as (props: Record<string, unknown>) => ReactNode;
const Path = PathModule as unknown as (props: Record<string, unknown>) => ReactNode;
const Rect = RectModule as unknown as (props: Record<string, unknown>) => ReactNode;

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'cliniccare_doctor_access';
const REFRESH_KEY = 'cliniccare_doctor_refresh';

type IconName =
  | 'home'
  | 'calendar'
  | 'users'
  | 'bell'
  | 'profile'
  | 'settings'
  | 'plus'
  | 'consultation'
  | 'prescription'
  | 'expense'
  | 'reports'
  | 'wallet'
  | 'clock'
  | 'check'
  | 'close'
  | 'arrow'
  | 'search'
  | 'shield'
  | 'heart';

function Icon({
  name,
  size = 22,
  color = '#64748B',
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <Rect x="3" y="3" width="7" height="7" rx="2" {...common} />
        <Rect x="14" y="3" width="7" height="4" rx="2" {...common} />
        <Rect x="14" y="10" width="7" height="11" rx="2" {...common} />
        <Rect x="3" y="13" width="7" height="8" rx="2" {...common} />
      </>
    ),
    calendar: (
      <>
        <Rect x="3" y="5" width="18" height="16" rx="3" {...common} />
        <Path d="M16 3v4M8 3v4M3 10h18" {...common} />
      </>
    ),
    users: (
      <>
        <Path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          {...common}
        />
      </>
    ),
    bell: (
      <>
        <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" {...common} />
      </>
    ),
    profile: (
      <>
        <Circle cx="12" cy="8" r="4" {...common} />
        <Path d="M4 21a8 8 0 0 1 16 0" {...common} />
      </>
    ),
    settings: (
      <>
        <Circle cx="12" cy="12" r="3" {...common} />
        <Path
          d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.7v-.09A1.7 1.7 0 0 0 11.2 18.36a1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 7.76 15 1.7 1.7 0 0 0 6.2 14H6v-2.7h.2A1.7 1.7 0 0 0 7.76 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06A1.7 1.7 0 0 0 11.2 6.55a1.7 1.7 0 0 0 1.03-1.56V4.9h2.7v.09A1.7 1.7 0 0 0 16 6.55a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 19.44 10a1.7 1.7 0 0 0 1.56 1.03H21v2.7h-.09A1.7 1.7 0 0 0 19.4 15Z"
          {...common}
        />
      </>
    ),
    plus: (
      <>
        <Path d="M12 5v14M5 12h14" {...common} />
      </>
    ),
    consultation: (
      <>
        <Path d="M20 11a8 8 0 1 1-3-6.25" {...common} />
        <Path d="M20 4v7h-7" {...common} />
      </>
    ),
    prescription: (
      <>
        <Rect x="5" y="3" width="14" height="18" rx="3" {...common} />
        <Path d="M9 8h6M12 8v8M9 16h6" {...common} />
      </>
    ),
    expense: (
      <>
        <Rect x="3" y="6" width="18" height="14" rx="3" {...common} />
        <Path d="M3 10h18M16 15h2" {...common} />
      </>
    ),
    reports: (
      <>
        <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...common} />
      </>
    ),
    wallet: (
      <>
        <Rect x="3" y="5" width="18" height="15" rx="3" {...common} />
        <Path d="M3 9h18M16 15h2" {...common} />
      </>
    ),
    clock: (
      <>
        <Circle cx="12" cy="12" r="9" {...common} />
        <Path d="M12 7v5l3 2" {...common} />
      </>
    ),
    check: (
      <>
        <Path d="m5 12 4 4L19 6" {...common} />
      </>
    ),
    close: (
      <>
        <Path d="m6 6 12 12M18 6 6 18" {...common} />
      </>
    ),
    arrow: (
      <>
        <Path d="M5 12h14M14 7l5 5-5 5" {...common} />
      </>
    ),
    search: (
      <>
        <Circle cx="10.5" cy="10.5" r="6.5" {...common} />
        <Path d="m16 16 5 5" {...common} />
      </>
    ),
    shield: (
      <>
        <Path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" {...common} />
        <Path d="m9 12 2 2 4-5" {...common} />
      </>
    ),
    heart: filled ? (
      <Path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"
        fill={color}
        stroke="none"
      />
    ) : (
      <Path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"
        {...common}
      />
    ),
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name]}
    </Svg>
  );
}

type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'register'
  | 'otp'
  | 'verification'
  | 'profileSetup'
  | 'clinicSetup'
  | 'dashboard'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'appointments'
  | 'queue'
  | 'schedule'
  | 'holidays'
  | 'history'
  | 'patients'
  | 'patientProfile'
  | 'duplicates'
  | 'consultation'
  | 'prescriptions';

type Dashboard = {
  doctorId: string;
  metrics: Record<string, number | string>;
  charts: {
    monthlyIncome: ChartPoint[];
    appointmentTrends: ChartPoint[];
    patientGrowth: ChartPoint[];
    incomeVsExpenses: ChartPoint[];
  };
};
type ChartPoint = {
  label: string;
  income: number;
  expenses: number;
  appointments: number;
  patientGrowth: number;
};
type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  tokenNumber?: number;
  isWalkIn?: boolean;
  patient?: { firstName: string; lastName: string; medicalRecordNumber: string };
};
type NotificationItem = {
  id: string;
  subject?: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};
type ProfileInfo = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles?: Array<{ role: { code: string } }>;
};
type Holiday = { id: string; date: string; name: string };
type Patient = {
  id: string;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string;
  gender?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string;
  medicalConditions?: string;
  currentMedication?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
};
type TimelineItem = {
  type: 'appointment' | 'consultation' | 'prescription' | 'document' | 'payment';
  id: string;
  occurredAt: string;
  data: Record<string, unknown>;
};
type Medicine = {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
};
type PrescriptionItem = {
  medicineName: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
  quantity?: number;
  foodInstructions?: string;
  specialInstructions?: string;
};
type PrescriptionPreview = {
  id: string;
  prescriptionNumber: string;
  verificationCode: string;
  verificationUrl: string | null;
  issuedAt: string;
  clinic: { name: string };
  doctor: { name: string; registrationNumber: string; specialty?: string };
  patient: { id: string; name: string; dateOfBirth: string; phone?: string };
  diagnosis?: string;
  investigationRecommendations?: string;
  followUpInstructions?: string;
  items: PrescriptionItem[];
  version: number;
  signed: boolean;
};
type PrescriptionRecord = {
  id: string;
  prescriptionNumber: string;
  version: number;
  status: string;
  issuedAt: string;
  correctionReason?: string;
  items: PrescriptionItem[];
};

async function api<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message ?? body?.error ?? `Request failed (${response.status})`);
  }
  return body.data as T;
}

function Button({
  label,
  onPress,
  secondary = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, secondary ? styles.buttonSecondary : null, style]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? '#2563EB' : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : null]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F8FB' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  splashText: {
    marginTop: 16,
    color: '#98A3B4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  brandText: { color: '#17233B', fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  authScreen: { flex: 1, backgroundColor: '#FFFFFF' },
  authScroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 },
  authHeader: { marginBottom: 24 },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 10,
    transform: [{ rotate: '180deg' }],
  },
  authTitle: {
    marginTop: 26,
    color: '#17233B',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  authSubtitle: { marginTop: 8, color: '#78859A', fontSize: 14, lineHeight: 21 },
  onboardingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  onboardingVisual: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  onboardingIcon: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
    borderWidth: 18,
    borderColor: '#F7FAFF',
  },
  onboardingCopy: { paddingHorizontal: 24, alignItems: 'center' },
  slideDots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginVertical: 22 },
  slideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DDE5EF' },
  slideDotActive: { width: 24, backgroundColor: '#2563EB' },
  textLink: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  form: { gap: 13 },
  field: { gap: 7 },
  fieldLabel: { color: '#4B5870', fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#17233B',
    fontSize: 14,
  },
  textArea: { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 },
  button: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#DFE6EE',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  buttonTextSecondary: { color: '#2563EB' },
  authFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: { color: '#78859A', fontSize: 13 },
  inlineError: {
    borderRadius: 9,
    backgroundColor: '#FFF0EF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  inlineErrorText: { color: '#C95050', fontSize: 12, lineHeight: 18 },
  otpInput: {
    height: 68,
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 12,
    backgroundColor: '#F9FBFD',
    textAlign: 'center',
    color: '#17233B',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 12,
  },
  successRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
    borderWidth: 14,
    borderColor: '#F7FAFF',
  },
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    padding: 13,
  },
  verificationTitle: { color: '#17233B', fontSize: 13, fontWeight: '700' },
  verificationText: { marginTop: 3, color: '#78859A', fontSize: 11 },
  avatarLarge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 24,
    backgroundColor: '#F4E8DF',
  },
  avatarLargeText: { color: '#9C6245', fontSize: 20, fontWeight: '800' },
  appScreen: { flex: 1, backgroundColor: '#F6F8FB' },
  dashboardScroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 92 },
  innerScroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 92 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerEyebrow: { color: '#98A3B4', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  headerTitle: {
    marginTop: 4,
    color: '#17233B',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#E16060',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 9,
    backgroundColor: '#F4E8DF',
  },
  headerAvatarText: { color: '#9C6245', fontSize: 11, fontWeight: '800' },
  quickActions: { gap: 9, paddingVertical: 8 },
  quickAction: {
    width: 104,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  quickActionText: {
    maxWidth: 92,
    color: '#536078',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  metricCard: {
    width: '48.1%',
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 13,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  metricTitle: { color: '#78859A', fontSize: 10 },
  metricValue: {
    marginTop: 3,
    color: '#17233B',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  financeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  financeCard: {
    flex: 1,
    minHeight: 82,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 13,
    justifyContent: 'center',
  },
  financeLabel: { color: '#78859A', fontSize: 10 },
  financeValue: { marginTop: 7, color: '#17233B', fontSize: 18, fontWeight: '800' },
  summaryCard: {
    flexDirection: 'row',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  summaryDivider: { width: 1, backgroundColor: '#EDF1F5' },
  summaryLabel: { height: 28, color: '#78859A', fontSize: 9, textAlign: 'center' },
  summaryValue: { color: '#17233B', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 9,
  },
  sectionTitle: { color: '#17233B', fontSize: 15, fontWeight: '800' },
  sectionMeta: { color: '#98A3B4', fontSize: 10 },
  appointmentCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 8,
  },
  timeBadge: {
    width: 58,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  timeBadgeText: { color: '#3975DE', fontSize: 9, fontWeight: '800' },
  appointmentName: { color: '#17233B', fontSize: 12, fontWeight: '700' },
  appointmentMeta: { marginTop: 4, color: '#78859A', fontSize: 10 },
  statusBadge: {
    borderRadius: 20,
    backgroundColor: '#EFF8F2',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  statusText: { color: '#35805A', fontSize: 8, fontWeight: '700' },
  chartCard: {
    height: 210,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { color: '#17233B', fontSize: 13, fontWeight: '800' },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 16,
  },
  chartColumn: { flex: 1, height: 150, alignItems: 'center', justifyContent: 'flex-end' },
  chartBars: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  chartBar: { width: 12, borderRadius: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  chartLabel: { marginTop: 7, color: '#98A3B4', fontSize: 8 },
  stateView: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  stateIconError: { backgroundColor: '#FFF0EF' },
  stateTitle: { marginTop: 12, color: '#17233B', fontSize: 14, fontWeight: '800' },
  stateMessage: {
    marginTop: 6,
    marginBottom: 14,
    maxWidth: 260,
    color: '#78859A',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  bottomNav: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E8EDF3',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 10,
  },
  navItem: { minWidth: 68, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navText: { color: '#99A4B4', fontSize: 9 },
  navTextActive: { color: '#2563EB', fontWeight: '700' },
  notificationCard: {
    flexDirection: 'row',
    gap: 11,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 13,
    marginBottom: 9,
  },
  notificationUnread: { borderColor: '#CCDDFC', backgroundColor: '#F8FBFF' },
  notificationIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  notificationSubject: { color: '#17233B', fontSize: 12, fontWeight: '700' },
  notificationBody: { marginTop: 4, color: '#78859A', fontSize: 11, lineHeight: 17 },
  notificationTime: { marginTop: 7, color: '#A8B1BF', fontSize: 9 },
  profileCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  profileName: { color: '#17233B', fontSize: 17, fontWeight: '800' },
  profileMeta: { marginTop: 5, color: '#78859A', fontSize: 11 },
  menuCard: {
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    marginTop: 12,
  },
  menuRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F6',
  },
  menuText: { flex: 1, color: '#536078', fontSize: 12, fontWeight: '600' },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#DDE5EF',
    paddingHorizontal: 3,
  },
  toggleActive: { backgroundColor: '#2563EB' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { alignSelf: 'flex-end' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,31,52,0.42)' },
  modalCard: {
    maxHeight: '82%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalTitle: { color: '#17233B', fontSize: 18, fontWeight: '800' },
  reportPreview: { alignItems: 'center', gap: 12, paddingVertical: 30 },
  reportPreviewText: {
    maxWidth: 280,
    color: '#78859A',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 3,
    marginBottom: 12,
  },
  segment: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  segmentActive: { backgroundColor: '#EDF4FF' },
  segmentText: { color: '#78859A', fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: '#2563EB', fontWeight: '800' },
  queueCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 8,
  },
  queueToken: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  queueTokenText: { color: '#2563EB', fontSize: 14, fontWeight: '800' },
  smallAction: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 9,
  },
  smallActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  twoFields: { flexDirection: 'row', gap: 10 },
  holidayCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 8,
  },
  detailActions: { gap: 8, marginTop: 18 },
  patientSearch: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  patientSearchInput: { flex: 1, color: '#17233B', fontSize: 13 },
  filterRow: { gap: 7, paddingVertical: 10 },
  filterChip: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
  },
  filterChipActive: { borderColor: '#2563EB', backgroundColor: '#EDF4FF' },
  filterChipText: { color: '#78859A', fontSize: 10, fontWeight: '700' },
  filterChipTextActive: { color: '#2563EB' },
  crmAction: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#BDD0F3',
    borderRadius: 10,
    backgroundColor: '#F8FBFF',
    marginBottom: 8,
  },
  crmActionText: { color: '#2563EB', fontSize: 12, fontWeight: '800' },
  duplicateLink: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 5,
  },
  duplicateLinkText: { color: '#3975DE', fontSize: 11, fontWeight: '700' },
  patientRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 8,
  },
  patientAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  patientAvatarText: { color: '#3975DE', fontSize: 12, fontWeight: '800' },
  patientAvatarLarge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#EDF4FF',
    marginBottom: 10,
  },
  patientAvatarTextLarge: { color: '#3975DE', fontSize: 18, fontWeight: '800' },
  editProfileButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE5F1',
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 14,
  },
  editProfileButtonText: { color: '#3975DE', fontSize: 11, fontWeight: '800' },
  infoCard: {
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginTop: 10,
  },
  infoRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0F2F6',
  },
  infoLabel: { color: '#78859A', fontSize: 11 },
  infoValue: {
    maxWidth: '55%',
    color: '#17233B',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  timelineRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#DCE7F7',
    paddingLeft: 10,
    marginLeft: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3975DE',
    marginLeft: -16,
  },
  timelineTitle: { color: '#17233B', fontSize: 12, fontWeight: '800' },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyCard: {
    width: '48.5%',
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyValue: { color: '#17233B', fontSize: 18, fontWeight: '800', marginTop: 4 },
  duplicateCard: {
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 10,
  },
  duplicatePatient: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F2F6',
    marginTop: 8,
  },
  mergeActions: { marginTop: 8 },
  consultationSteps: { gap: 7, paddingVertical: 10 },
  consultationStep: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
  },
  consultationStepActive: { borderColor: '#2563EB', backgroundColor: '#EDF4FF' },
  consultationStepText: { color: '#78859A', fontSize: 10, fontWeight: '700' },
  consultationStepTextActive: { color: '#2563EB' },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  templateChip: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE6EE',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
  },
  templateChipText: { color: '#3975DE', fontSize: 10, fontWeight: '700' },
  emrSummaryCard: {
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 9,
  },
  summaryText: { color: '#536078', fontSize: 12, lineHeight: 18 },
  medicineResult: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    padding: 9,
    justifyContent: 'center',
  },
  prescriptionLine: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  prescriptionPreview: {
    borderWidth: 1,
    borderColor: '#CBD7E7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  prescriptionPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 12,
  },
  prescriptionClinic: { color: '#2563EB', fontSize: 17, fontWeight: '800' },
  prescriptionDoctor: { marginTop: 5, color: '#17233B', fontSize: 12, fontWeight: '700' },
  prescriptionNumber: { color: '#17233B', fontSize: 11, fontWeight: '800' },
  prescriptionPatient: { borderBottomWidth: 1, borderBottomColor: '#EDF1F5', paddingVertical: 12 },
  prescriptionSection: {
    borderTopWidth: 1,
    borderTopColor: '#EDF1F5',
    marginTop: 10,
    paddingTop: 10,
  },
  prescriptionPreviewLine: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F6',
  },
  prescriptionDose: { maxWidth: 110, color: '#536078', fontSize: 10, textAlign: 'right' },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  verificationCode: { color: '#17233B', fontSize: 9, fontWeight: '800' },
  signatureBox: {
    width: 150,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#17233B',
  },
  signatureText: { color: '#536078', fontSize: 9, paddingBottom: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  prescriptionHistoryRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 8,
  },
});

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure = false,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#98A3B4"
        secureTextEntry={secure}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline ? styles.textArea : null]}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={[styles.brandMark, compact ? { width: 34, height: 34 } : null]}>
        <Icon name="heart" size={compact ? 17 : 24} color="#fff" filled />
      </View>
      <Text style={[styles.brandText, compact ? { fontSize: 18 } : null]}>
        Clinic<Text style={{ color: '#2563EB' }}>Care</Text>
      </Text>
    </View>
  );
}

function StateView({
  type,
  title,
  message,
  onRetry,
}: {
  type: 'loading' | 'empty' | 'error';
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.stateView}>
      {type === 'loading' ? (
        <ActivityIndicator size="large" color="#2563EB" />
      ) : (
        <View style={[styles.stateIcon, type === 'error' ? styles.stateIconError : null]}>
          <Icon
            name={type === 'error' ? 'close' : 'calendar'}
            size={23}
            color={type === 'error' ? '#C95050' : '#2563EB'}
          />
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {onRetry && type === 'error' ? (
        <Button label="Try again" onPress={onRetry} secondary style={{ width: 130 }} />
      ) : null}
    </View>
  );
}

function MetricCard({
  title,
  value,
  tone = 'blue',
  icon,
}: {
  title: string;
  value: string;
  tone?: 'blue' | 'teal' | 'violet' | 'amber';
  icon: IconName;
}) {
  const toneStyles = {
    blue: { bg: '#EDF4FF', fg: '#3975DE' },
    teal: { bg: '#E8F7F4', fg: '#168E82' },
    violet: { bg: '#F2EDFC', fg: '#8062C2' },
    amber: { bg: '#FFF4E6', fg: '#D29132' },
  }[tone];
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: toneStyles.bg }]}>
        <Icon name={icon} size={17} color={toneStyles.fg} />
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MiniChart({
  title,
  points,
  type,
}: {
  title: string;
  points: ChartPoint[];
  type: 'income' | 'appointments' | 'growth' | 'comparison';
}) {
  const values = points.map((point) =>
    type === 'income'
      ? point.income
      : type === 'appointments'
        ? point.appointments
        : type === 'growth'
          ? point.patientGrowth
          : Math.max(point.income, point.expenses),
  );
  const max = Math.max(...values, 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.chartArea}>
        {points.map((point, index) => {
          const incomeHeight = Math.max(4, (point.income / max) * 88);
          const expenseHeight = Math.max(4, (point.expenses / max) * 88);
          const value =
            type === 'income'
              ? point.income
              : type === 'appointments'
                ? point.appointments
                : type === 'growth'
                  ? point.patientGrowth
                  : null;
          return (
            <View key={point.label} style={styles.chartColumn}>
              <View style={styles.chartBars}>
                {type === 'comparison' ? (
                  <>
                    <View
                      style={[
                        styles.chartBar,
                        { height: incomeHeight, backgroundColor: '#3978EE' },
                      ]}
                    />
                    <View
                      style={[
                        styles.chartBar,
                        { height: expenseHeight, backgroundColor: '#84CFC5' },
                      ]}
                    />
                  </>
                ) : (
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: value ? Math.max(4, (value / max) * 88) : 4,
                        backgroundColor: index === points.length - 1 ? '#2563EB' : '#86AEEB',
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.chartLabel}>{point.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [screen, setScreen] = useState<Screen>('splash');
  const [token, setToken] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month'>('day');
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [scheduleEnd, setScheduleEnd] = useState('17:00');
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('13:30');
  const [consultationDuration, setConsultationDuration] = useState('15');
  const [followUpDuration, setFollowUpDuration] = useState('10');
  const [dailyMaximum, setDailyMaximum] = useState('40');
  const [appointmentFee, setAppointmentFee] = useState('500');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [isReceptionist, setIsReceptionist] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<
    | null
    | 'patient'
    | 'appointment'
    | 'consultation'
    | 'prescription'
    | 'expense'
    | 'payment'
    | 'reports'
  >(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionFirstName, setActionFirstName] = useState('');
  const [actionLastName, setActionLastName] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [actionPatientId, setActionPatientId] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionCategory, setActionCategory] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [actionText, setActionText] = useState('');
  const [patientEditId, setPatientEditId] = useState<string | null>(null);
  const [actionGender, setActionGender] = useState('');
  const [actionAddress, setActionAddress] = useState('');
  const [actionPhone, setActionPhone] = useState('');
  const [actionBloodGroup, setActionBloodGroup] = useState('');
  const [actionAllergies, setActionAllergies] = useState('');
  const [actionConditions, setActionConditions] = useState('');
  const [actionMedication, setActionMedication] = useState('');
  const [actionEmergencyName, setActionEmergencyName] = useState('');
  const [actionEmergencyPhone, setActionEmergencyPhone] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientFilter, setPatientFilter] = useState<
    'all' | 'new' | 'returning' | 'follow-up-due' | 'payment-pending'
  >('all');
  const [patientHistory, setPatientHistory] = useState<Record<string, unknown> | null>(null);
  const [patientTimeline, setPatientTimeline] = useState<TimelineItem[]>([]);
  const [duplicates, setDuplicates] = useState<Array<{ reason: string; patients: Patient[] }>>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState('');
  const [consultationId, setConsultationId] = useState('');
  const [consultationStep, setConsultationStep] = useState(0);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [clinicalTemplates, setClinicalTemplates] = useState<
    Array<{
      id: string;
      name: string;
      symptoms?: string;
      examination?: string;
      treatmentPlan?: string;
    }>
  >([]);
  const [consultationSymptoms, setConsultationSymptoms] = useState('');
  const [consultationExam, setConsultationExam] = useState('');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [consultationPlan, setConsultationPlan] = useState('');
  const [consultationDiagnosis, setConsultationDiagnosis] = useState('');
  const [consultationFollowUp, setConsultationFollowUp] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [oxygen, setOxygen] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  const [medicineResults, setMedicineResults] = useState<Medicine[]>([]);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [prescriptionMedicine, setPrescriptionMedicine] = useState('');
  const [prescriptionGeneric, setPrescriptionGeneric] = useState('');
  const [prescriptionBrand, setPrescriptionBrand] = useState('');
  const [prescriptionStrength, setPrescriptionStrength] = useState('');
  const [prescriptionDosage, setPrescriptionDosage] = useState('');
  const [prescriptionFrequency, setPrescriptionFrequency] = useState('');
  const [prescriptionDuration, setPrescriptionDuration] = useState('');
  const [prescriptionQuantity, setPrescriptionQuantity] = useState('');
  const [prescriptionFood, setPrescriptionFood] = useState('');
  const [prescriptionSpecial, setPrescriptionSpecial] = useState('');
  const [prescriptionDiagnosis, setPrescriptionDiagnosis] = useState('');
  const [prescriptionInvestigations, setPrescriptionInvestigations] = useState('');
  const [prescriptionFollowUp, setPrescriptionFollowUp] = useState('');
  const [prescriptionHistory, setPrescriptionHistory] = useState<PrescriptionRecord[]>([]);
  const [prescriptionPreview, setPrescriptionPreview] = useState<PrescriptionPreview | null>(null);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState('');
  const [prescriptionCorrectionReason, setPrescriptionCorrectionReason] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (active && savedToken) {
          setToken(savedToken);
          setScreen('dashboard');
        } else if (active) {
          setScreen('onboarding');
        }
      } catch {
        if (active) setScreen('onboarding');
      }
    }, 1200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  async function saveTokens(accessToken: string, refresh: string | undefined) {
    setToken(accessToken);
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    if (refresh) {
      await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    }
  }

  async function loadDashboard() {
    if (!token) return;
    setDashboardLoading(true);
    setDashboardError('');
    try {
      if (isReceptionist) {
        const [upcoming, clinicPatients] = await Promise.all([
          api<Appointment[]>(
            '/appointments?sortOrder=asc&pageSize=50&from=' + new Date().toISOString(),
            token,
          ),
          api<Patient[]>('/patients?pageSize=100&sortBy=createdAt&sortOrder=desc', token),
        ]);
        setDashboard(null);
        setAppointments(upcoming);
        setPatients(clinicPatients);
      } else {
        const [dash, upcoming] = await Promise.all([
          api<Dashboard>('/doctors/dashboard', token),
          api<Appointment[]>(
            '/appointments?sortOrder=asc&pageSize=8&from=' + new Date().toISOString(),
            token,
          ),
        ]);
        setDashboard(dash);
        setAppointments(upcoming);
      }
    } catch (caught) {
      setDashboardError(caught instanceof Error ? caught.message : 'Unable to load dashboard');
    } finally {
      setDashboardLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (screen === 'dashboard' && token) void loadDashboard();
  }, [screen, token, isReceptionist]);

  useEffect(() => {
    if (token) void loadProfile();
  }, [token]);

  async function loadNotifications() {
    if (!token) return;
    try {
      const items = await api<NotificationItem[]>(
        '/notifications?pageSize=30&sortOrder=desc',
        token,
      );
      setNotifications(items);
    } catch {
      setNotifications([]);
    }
  }

  async function loadProfile() {
    if (!token) return;
    try {
      const data = await api<ProfileInfo>('/users/me', token);
      setProfile(data);
      setIsReceptionist(
        Boolean(data.roles?.some((assignment) => assignment.role.code === 'RECEPTIONIST')),
      );
    } catch {
      setProfile(null);
    }
  }

  async function loadPatients(search = patientSearch, filter = patientFilter) {
    if (!token) return;
    setPatientLoading(true);
    setPatientError('');
    try {
      const query =
        `pageSize=100&sortBy=createdAt&sortOrder=desc&filter=${encodeURIComponent(filter)}` +
        (search ? `&search=${encodeURIComponent(search)}` : '');
      setPatients(await api<Patient[]>(`/patients?${query}`, token));
    } catch (caught) {
      setPatientError(caught instanceof Error ? caught.message : 'Unable to load patients');
    } finally {
      setPatientLoading(false);
    }
  }

  async function loadPatientDetails(patient: Patient) {
    if (!token) return;
    setPatientLoading(true);
    setPatientError('');
    try {
      const details = await api<Patient>(`/patients/${patient.id}`, token);
      if (isReceptionist) {
        setSelectedPatient(details);
        setPatientHistory(null);
        setPatientTimeline([]);
        setScreen('patientProfile');
        return;
      }
      const [history, timeline] = await Promise.all([
        api<Record<string, unknown>>(`/patients/${patient.id}/history?pageSize=20&page=1`, token),
        api<{ timeline: TimelineItem[] }>(`/patients/${patient.id}/timeline`, token),
      ]);
      setSelectedPatient(details);
      setPatientHistory(history);
      setPatientTimeline(timeline.timeline);
      setScreen('patientProfile');
    } catch (caught) {
      setPatientError(caught instanceof Error ? caught.message : 'Unable to load patient profile');
    } finally {
      setPatientLoading(false);
    }
  }

  async function startConsultation(patient: Patient) {
    if (!token) return;
    setConsultationLoading(true);
    setConsultationError('');
    try {
      const record = await api<{ id: string }>('/consultations', token, {
        method: 'POST',
        body: JSON.stringify({ patientId: patient.id, clinicalNotes: '' }),
      });
      setConsultationId(record.id);
      setSelectedPatient(patient);
      setConsultationStep(0);
      setConsultationSymptoms('');
      setConsultationExam('');
      setConsultationNotes('');
      setConsultationPlan('');
      setConsultationDiagnosis('');
      setConsultationFollowUp('');
      setBloodPressure('');
      setPulse('');
      setTemperature('');
      setOxygen('');
      setHeight('');
      setWeight('');
      setClinicalTemplates(
        await api<
          Array<{
            id: string;
            name: string;
            symptoms?: string;
            examination?: string;
            treatmentPlan?: string;
          }>
        >('/consultations/templates', token),
      );
      setScreen('consultation');
    } catch (caught) {
      setConsultationError(
        caught instanceof Error ? caught.message : 'Unable to start consultation',
      );
    } finally {
      setConsultationLoading(false);
    }
  }

  async function saveConsultationDraft() {
    if (!token || !consultationId) return;
    setConsultationLoading(true);
    setConsultationError('');
    try {
      await api(`/consultations/${consultationId}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          clinicalNotes: consultationNotes,
          symptoms: consultationSymptoms,
          examination: consultationExam,
          treatmentPlan: consultationPlan,
          ...(consultationFollowUp
            ? { followUpAt: new Date(consultationFollowUp).toISOString() }
            : {}),
        }),
      });
    } catch (caught) {
      setConsultationError(caught instanceof Error ? caught.message : 'Unable to save draft');
    } finally {
      setConsultationLoading(false);
    }
  }

  async function saveVitalsAndDiagnosis() {
    if (!token || !consultationId) return;
    setConsultationLoading(true);
    setConsultationError('');
    try {
      const [systolic, diastolic] = bloodPressure.includes('/')
        ? bloodPressure.split('/').map((value) => Number(value.trim()))
        : [undefined, undefined];
      await api(`/consultations/${consultationId}/vitals`, token, {
        method: 'POST',
        body: JSON.stringify({
          ...(systolic ? { systolic } : {}),
          ...(diastolic ? { diastolic } : {}),
          ...(pulse ? { pulse: Number(pulse) } : {}),
          ...(temperature ? { temperature: Number(temperature) } : {}),
          ...(oxygen ? { oxygenSaturation: Number(oxygen) } : {}),
          ...(height ? { heightCm: Number(height) } : {}),
          ...(weight ? { weightKg: Number(weight) } : {}),
        }),
      });
      if (consultationDiagnosis.trim()) {
        await api(`/consultations/${consultationId}/diagnoses`, token, {
          method: 'POST',
          body: JSON.stringify({ description: consultationDiagnosis, isPrimary: true }),
        });
      }
    } catch (caught) {
      setConsultationError(
        caught instanceof Error ? caught.message : 'Unable to save clinical measurements',
      );
    } finally {
      setConsultationLoading(false);
    }
  }

  async function finalizeConsultation() {
    if (!token || !consultationId) return;
    setConsultationLoading(true);
    setConsultationError('');
    try {
      await saveConsultationDraft();
      await saveVitalsAndDiagnosis();
      await api(`/consultations/${consultationId}/finalize`, token, { method: 'POST', body: '{}' });
      setConsultationStep(9);
    } catch (caught) {
      setConsultationError(
        caught instanceof Error ? caught.message : 'Unable to finalize consultation',
      );
    } finally {
      setConsultationLoading(false);
    }
  }

  async function searchMedicines(search: string) {
    setMedicineSearch(search);
    if (!token || search.trim().length < 2) {
      setMedicineResults([]);
      return;
    }
    try {
      setMedicineResults(
        await api<Medicine[]>(
          `/prescriptions/search-medicines?search=${encodeURIComponent(search)}`,
          token,
        ),
      );
    } catch (caught) {
      setPrescriptionError(caught instanceof Error ? caught.message : 'Unable to search medicines');
    }
  }

  function addPrescriptionItem() {
    if (
      !prescriptionMedicine.trim() ||
      !prescriptionDosage.trim() ||
      !prescriptionFrequency.trim()
    ) {
      setPrescriptionError('Medicine, dosage and frequency are required.');
      return;
    }
    setPrescriptionItems((items) => [
      ...items,
      {
        medicineName: prescriptionMedicine.trim(),
        genericName: prescriptionGeneric || undefined,
        brandName: prescriptionBrand || undefined,
        strength: prescriptionStrength || undefined,
        dosage: prescriptionDosage.trim(),
        frequency: prescriptionFrequency.trim(),
        durationDays: prescriptionDuration ? Number(prescriptionDuration) : undefined,
        quantity: prescriptionQuantity ? Number(prescriptionQuantity) : undefined,
        foodInstructions: prescriptionFood || undefined,
        specialInstructions: prescriptionSpecial || undefined,
      },
    ]);
    setPrescriptionMedicine('');
    setPrescriptionGeneric('');
    setPrescriptionBrand('');
    setPrescriptionStrength('');
    setPrescriptionDosage('');
    setPrescriptionFrequency('');
    setPrescriptionDuration('');
    setPrescriptionQuantity('');
    setPrescriptionFood('');
    setPrescriptionSpecial('');
    setMedicineResults([]);
    setPrescriptionError('');
  }

  async function issuePrescription() {
    if (!token || !consultationId || !selectedPatient) return;
    if (prescriptionItems.length === 0) {
      setPrescriptionError('Add at least one medicine before issuing.');
      return;
    }
    setPrescriptionLoading(true);
    setPrescriptionError('');
    try {
      const issued = await api<{ id: string }>('/prescriptions', token, {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient.id,
          consultationId,
          items: prescriptionItems,
          diagnosis: prescriptionDiagnosis,
          investigationRecommendations: prescriptionInvestigations,
          followUpInstructions: prescriptionFollowUp,
        }),
      });
      setPrescriptionPreview(
        await api<PrescriptionPreview>(`/prescriptions/${issued.id}/preview`, token),
      );
      setScreen('prescriptions');
    } catch (caught) {
      setPrescriptionError(
        caught instanceof Error ? caught.message : 'Unable to issue prescription',
      );
    } finally {
      setPrescriptionLoading(false);
    }
  }

  async function loadPrescriptionHistory() {
    if (!token) return;
    setPrescriptionLoading(true);
    setPrescriptionError('');
    try {
      setPrescriptionHistory(
        await api<PrescriptionRecord[]>(
          `/prescriptions?pageSize=50&sortOrder=desc${selectedPatient ? `&patientId=${selectedPatient.id}` : ''}`,
          token,
        ),
      );
    } catch (caught) {
      setPrescriptionError(
        caught instanceof Error ? caught.message : 'Unable to load prescription history',
      );
    } finally {
      setPrescriptionLoading(false);
    }
  }

  async function correctPrescription(id: string) {
    if (!token || !selectedPatient || !consultationId) return;
    if (prescriptionCorrectionReason.trim().length < 5) {
      setPrescriptionError('A correction reason of at least 5 characters is required.');
      return;
    }
    setPrescriptionLoading(true);
    setPrescriptionError('');
    try {
      const corrected = await api<{ id: string }>(`/prescriptions/${id}/correct`, token, {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient.id,
          consultationId,
          items: prescriptionItems,
          diagnosis: prescriptionDiagnosis,
          investigationRecommendations: prescriptionInvestigations,
          followUpInstructions: prescriptionFollowUp,
          correctionReason: prescriptionCorrectionReason,
        }),
      });
      setPrescriptionPreview(
        await api<PrescriptionPreview>(`/prescriptions/${corrected.id}/preview`, token),
      );
    } catch (caught) {
      setPrescriptionError(
        caught instanceof Error ? caught.message : 'Unable to issue corrected prescription',
      );
    } finally {
      setPrescriptionLoading(false);
    }
  }

  async function openPrescriptionPreview(id: string) {
    if (!token) return;
    try {
      setPrescriptionPreview(await api<PrescriptionPreview>(`/prescriptions/${id}/preview`, token));
      setScreen('prescriptions');
    } catch (caught) {
      setPrescriptionError(
        caught instanceof Error ? caught.message : 'Unable to open prescription preview',
      );
    }
  }

  function prescriptionHtml(preview: PrescriptionPreview) {
    const rows = preview.items
      .map(
        (item) => `
      <tr><td><strong>${item.medicineName}</strong><br/>${item.genericName ? `${item.genericName} · ` : ''}${item.brandName ? `${item.brandName} · ` : ''}${item.strength ?? ''}</td>
      <td>${item.dosage}<br/>${item.frequency}</td><td>${item.durationDays ? `${item.durationDays} days` : '-'}<br/>Qty ${item.quantity ?? '-'}</td>
      <td>${item.foodInstructions ?? ''}<br/>${item.specialInstructions ?? ''}</td></tr>`,
      )
      .join('');
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17233b;padding:28px">
      <header style="display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:16px">
        <div><h1 style="margin:0;color:#2563eb">${preview.clinic.name}</h1><strong>Dr. ${preview.doctor.name}</strong><br/>Reg. ${preview.doctor.registrationNumber}</div>
        <div style="text-align:right"><strong>${preview.prescriptionNumber}</strong><br/>${new Date(preview.issuedAt).toLocaleDateString('en-IN')}<br/>Version ${preview.version}</div>
      </header>
      <section style="margin:20px 0"><strong>Patient:</strong> ${preview.patient.name} · ${preview.patient.id}<br/><strong>Date of birth:</strong> ${preview.patient.dateOfBirth} · <strong>Mobile:</strong> ${preview.patient.phone ?? '-'}</section>
      ${preview.diagnosis ? `<section><strong>Diagnosis</strong><p>${preview.diagnosis}</p></section>` : ''}
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Medicine</th><th>Dosage</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>
      ${preview.investigationRecommendations ? `<section><strong>Investigations</strong><p>${preview.investigationRecommendations}</p></section>` : ''}
      ${preview.followUpInstructions ? `<section><strong>Follow-up</strong><p>${preview.followUpInstructions}</p></section>` : ''}
      <footer style="display:flex;justify-content:space-between;margin-top:40px;border-top:1px solid #dfe6ee;padding-top:16px"><div>Verification: ${preview.verificationCode}</div><div style="text-align:center"><div style="height:48px;border-bottom:1px solid #17233b;width:180px"></div><strong>Doctor signature</strong></div></footer>
      ${preview.verificationUrl ? `<p style="margin-top:12px;font-size:10px;color:#78859a">Verification URL: ${preview.verificationUrl}</p>` : ''}
    </body></html>`;
  }

  async function downloadOrPrintPrescription(
    preview: PrescriptionPreview,
    action: 'print' | 'share',
  ) {
    try {
      const generated = await Print.printToFileAsync({
        html: prescriptionHtml(preview),
        base64: false,
      });
      if (action === 'share') {
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(generated.uri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: 'Share prescription',
          });
      } else {
        await Print.printAsync({ uri: generated.uri });
      }
    } catch (caught) {
      setPrescriptionError(
        caught instanceof Error ? caught.message : 'Unable to generate prescription PDF',
      );
    }
  }

  async function loadDuplicates() {
    if (!token) return;
    setPatientLoading(true);
    setPatientError('');
    try {
      setDuplicates(
        await api<Array<{ reason: string; patients: Patient[] }>>('/patients/duplicates', token),
      );
    } catch (caught) {
      setPatientError(
        caught instanceof Error ? caught.message : 'Unable to detect duplicate records',
      );
    } finally {
      setPatientLoading(false);
    }
  }

  useEffect(() => {
    if (screen === 'notifications') void loadNotifications();
    if (screen === 'profile') void loadProfile();
    if (screen === 'patients') void loadPatients();
    if (screen === 'duplicates') void loadDuplicates();
    if (screen === 'prescriptions') void loadPrescriptionHistory();
  }, [screen, token]);

  async function loadAppointments(includeHistory = false) {
    if (!token) return;
    setAppointmentsLoading(true);
    setAppointmentsError('');
    try {
      const now = new Date();
      const from = includeHistory
        ? new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
        : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const items = await api<Appointment[]>(
        `/appointments?sortOrder=asc&pageSize=100&from=${encodeURIComponent(from)}`,
        token,
      );
      setAppointments(items);
    } catch (caught) {
      setAppointmentsError(
        caught instanceof Error ? caught.message : 'Unable to load appointments',
      );
    } finally {
      setAppointmentsLoading(false);
    }
  }

  async function loadHolidays() {
    if (!token) return;
    try {
      setHolidays(await api<Holiday[]>('/appointments/holidays', token));
    } catch (caught) {
      setAppointmentsError(caught instanceof Error ? caught.message : 'Unable to load holidays');
    }
  }

  useEffect(() => {
    if (screen === 'appointments' || screen === 'queue' || screen === 'history')
      void loadAppointments(screen === 'history');
    if (screen === 'holidays') void loadHolidays();
  }, [screen, token]);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const body = await api<{
        mfaRequired?: boolean;
        challengeId?: string;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceName: 'ClinicCare Doctor App' }),
      });
      if (body.mfaRequired && body.challengeId) {
        setChallengeId(body.challengeId);
        setScreen('otp');
      } else if (body.accessToken) {
        await saveTokens(body.accessToken, body.refreshToken);
        setScreen('verification');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp() {
    setError('');
    setLoading(true);
    try {
      const body = await api<{ accessToken: string; refreshToken?: string }>(
        '/auth/otp/verify',
        null,
        {
          method: 'POST',
          body: JSON.stringify({ challengeId, code: otp, deviceName: 'ClinicCare Doctor App' }),
        },
      );
      await saveTokens(body.accessToken, body.refreshToken);
      setScreen('verification');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      await api<{ id: string; doctorId: string }>('/auth/register/doctor', null, {
        method: 'POST',
        body: JSON.stringify({
          clinicId,
          email,
          password,
          displayName,
          registrationNumber,
          specialty,
        }),
      });
      setScreen('login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function mergePatients(target: Patient, source: Patient) {
    if (!token) return;
    setPatientLoading(true);
    setPatientError('');
    try {
      await api(`/patients/${target.id}/merge`, token, {
        method: 'POST',
        body: JSON.stringify({ sourcePatientId: source.id, confirmed: true }),
      });
      await loadDuplicates();
      await loadPatients();
    } catch (caught) {
      setPatientError(caught instanceof Error ? caught.message : 'Unable to merge patient records');
    } finally {
      setPatientLoading(false);
    }
  }

  async function executeAction() {
    if (!token) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (action === 'patient') {
        const payload = {
          firstName: actionFirstName,
          lastName: actionLastName,
          dateOfBirth: actionDate || new Date().toISOString().slice(0, 10),
          phone: actionPhone || undefined,
          gender: actionGender || undefined,
          address: actionAddress || undefined,
          bloodGroup: actionBloodGroup || undefined,
          allergies: actionAllergies || undefined,
          medicalConditions: actionConditions || undefined,
          currentMedication: actionMedication || undefined,
          emergencyContactName: actionEmergencyName || undefined,
          emergencyContactPhone: actionEmergencyPhone || undefined,
        };
        await api(patientEditId ? `/patients/${patientEditId}` : '/patients', token, {
          method: patientEditId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
      } else if (action === 'expense') {
        await api('/expenses', token, {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(actionAmount),
            category: actionCategory || 'OTHER',
            occurredAt: new Date().toISOString(),
            description: actionDescription,
          }),
        });
      } else if (action === 'appointment') {
        if (!actionPatientId) throw new Error('Patient ID is required');
        const doctorId =
          dashboard?.doctorId ??
          (await api<{ items: Array<{ id: string }> }>('/doctors?pageSize=1', token)).items[0]?.id;
        if (!doctorId) throw new Error('No active doctor is available for booking');
        const starts = new Date(actionDate).toISOString();
        const ends = new Date(new Date(actionDate).getTime() + 30 * 60_000).toISOString();
        await api('/appointments', token, {
          method: 'POST',
          body: JSON.stringify({
            patientId: actionPatientId,
            doctorId,
            startsAt: starts,
            endsAt: ends,
          }),
        });
      } else if (action === 'consultation') {
        if (!actionPatientId) throw new Error('Patient ID is required');
        await api('/consultations', token, {
          method: 'POST',
          body: JSON.stringify({ patientId: actionPatientId, clinicalNotes: actionText }),
        });
      } else if (action === 'prescription') {
        if (!actionPatientId) throw new Error('Patient ID is required');
        const consultation = await api<{ id: string }>('/consultations', token, {
          method: 'POST',
          body: JSON.stringify({ patientId: actionPatientId, clinicalNotes: actionText }),
        });
        await api('/prescriptions', token, {
          method: 'POST',
          body: JSON.stringify({
            patientId: actionPatientId,
            consultationId: consultation.id,
            items: [
              { medicineName: actionCategory, dosage: actionAmount, frequency: actionDescription },
            ],
          }),
        });
      } else if (action === 'payment') {
        if (!actionPatientId || !actionAmount)
          throw new Error('Patient ID and amount are required');
        const idempotencyKey = `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const pending = await api<{ id: string }>('/payments', token, {
          method: 'POST',
          body: JSON.stringify({
            patientId: actionPatientId,
            amount: Number(actionAmount),
            method: 'CASH',
            serviceCategory: actionCategory || 'OTHER_SERVICES',
            idempotencyKey,
          }),
        });
        const verified = await api<{ receipt?: { receiptNumber?: string } }>(
          `/payments/${pending.id}/verify`,
          token,
          { method: 'POST', body: '{}' },
        );
        setActionError(
          `Payment collected. Receipt ${verified.receipt?.receiptNumber ?? pending.id} is ready.`,
        );
        await loadDashboard();
        return;
      }
      setAction(null);
      setPatientEditId(null);
      if (action === 'patient') await loadPatients();
      await loadDashboard();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Unable to complete action');
    } finally {
      setActionLoading(false);
    }
  }

  async function updateAppointment(id: string, status: string, tokenNumber?: number) {
    if (!token) return;
    try {
      await api(`/appointments/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ status, ...(tokenNumber ? { tokenNumber } : {}) }),
      });
      await loadAppointments(screen === 'history');
    } catch (caught) {
      setAppointmentsError(
        caught instanceof Error ? caught.message : 'Unable to update appointment',
      );
    }
  }

  async function cancelAppointment(id: string) {
    await updateAppointment(id, 'CANCELLED');
  }

  async function rescheduleAppointment(id: string) {
    if (!selectedAppointment || !dashboard?.doctorId) return;
    const starts = new Date(selectedAppointment.startsAt);
    starts.setDate(starts.getDate() + 1);
    const ends = new Date(starts.getTime() + 30 * 60_000);
    try {
      await api(`/appointments/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ startsAt: starts.toISOString(), endsAt: ends.toISOString() }),
      });
      await loadAppointments(screen === 'history');
      setSelectedAppointment(null);
    } catch (caught) {
      setAppointmentsError(
        caught instanceof Error ? caught.message : 'Unable to reschedule appointment',
      );
    }
  }

  async function saveSchedule() {
    if (!token || !dashboard?.doctorId) return;
    try {
      await api(`/doctors/${dashboard.doctorId}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          clinicHoursStart: scheduleStart,
          clinicHoursEnd: scheduleEnd,
          breakStart,
          breakEnd,
          consultationDuration: Number(consultationDuration),
          followUpDuration: Number(followUpDuration),
          dailyMaxAppointments: Number(dailyMaximum),
          appointmentFee: Number(appointmentFee),
        }),
      });
      setAppointmentsError('');
    } catch (caught) {
      setAppointmentsError(caught instanceof Error ? caught.message : 'Unable to save schedule');
    }
  }

  async function createHoliday() {
    if (!token || !holidayDate || !holidayName) return;
    try {
      await api('/appointments/holidays', token, {
        method: 'POST',
        body: JSON.stringify({ date: holidayDate, name: holidayName }),
      });
      setHolidayDate('');
      setHolidayName('');
      await loadHolidays();
    } catch (caught) {
      setAppointmentsError(caught instanceof Error ? caught.message : 'Unable to add holiday');
    }
  }

  async function deleteHoliday(id: string) {
    if (!token) return;
    try {
      await api(`/appointments/holidays/${id}`, token, { method: 'DELETE' });
      await loadHolidays();
    } catch (caught) {
      setAppointmentsError(caught instanceof Error ? caught.message : 'Unable to remove holiday');
    }
  }

  async function logout() {
    if (token) {
      try {
        await api('/auth/logout', token, { method: 'POST', body: '{}' });
      } catch (caught) {
        void caught;
      }
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    setToken(null);
    setScreen('login');
  }

  function AuthHeader({
    title,
    subtitle,
    back,
  }: {
    title: string;
    subtitle: string;
    back?: () => void;
  }) {
    return (
      <View style={styles.authHeader}>
        {back ? (
          <TouchableOpacity onPress={back} style={styles.backButton}>
            <Icon name="arrow" size={20} color="#64748B" />
          </TouchableOpacity>
        ) : null}
        <Brand compact />
        <Text style={styles.authTitle}>{title}</Text>
        <Text style={styles.authSubtitle}>{subtitle}</Text>
      </View>
    );
  }

  function Onboarding() {
    const slides = [
      {
        icon: 'calendar' as IconName,
        title: 'Your practice, at a glance',
        text: 'Manage appointments, patients and clinic performance from one secure workspace.',
      },
      {
        icon: 'consultation' as IconName,
        title: 'Focused patient care',
        text: 'Move smoothly from consultation to prescription without losing context.',
      },
      {
        icon: 'shield' as IconName,
        title: 'Secure clinical workflow',
        text: 'Keep patient information and practice records protected with ClinicCare.',
      },
    ];
    const [slide, setSlide] = useState(0);
    const item = slides[slide];
    return (
      <SafeAreaView style={styles.authScreen}>
        <View style={styles.onboardingTop}>
          <Brand compact />
          <TouchableOpacity onPress={() => setScreen('login')}>
            <Text style={styles.textLink}>Skip</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.onboardingVisual}>
          <View style={styles.onboardingIcon}>
            <Icon name={item.icon} size={52} color="#2563EB" />
          </View>
        </View>
        <View style={styles.onboardingCopy}>
          <Text style={styles.authTitle}>{item.title}</Text>
          <Text style={styles.authSubtitle}>{item.text}</Text>
        </View>
        <View style={styles.slideDots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.slideDot, index === slide ? styles.slideDotActive : null]}
            />
          ))}
        </View>
        <Button
          label={slide === slides.length - 1 ? 'Get started' : 'Continue'}
          onPress={() =>
            slide === slides.length - 1 ? setScreen('register') : setSlide(slide + 1)
          }
          style={{ marginHorizontal: 24, marginBottom: 28 }}
        />
      </SafeAreaView>
    );
  }

  function Login() {
    return (
      <SafeAreaView style={styles.authScreen}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <AuthHeader title="Welcome back" subtitle="Sign in to manage your practice." />
          {error ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.form}>
            <Field
              label="Email address"
              value={email}
              onChange={setEmail}
              placeholder="doctor@cliniccare.test"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              secure
            />
            <TouchableOpacity
              onPress={() =>
                setError('Password recovery is available from the ClinicCare web portal.')
              }
            >
              <Text style={[styles.textLink, { alignSelf: 'flex-end' }]}>Forgot password?</Text>
            </TouchableOpacity>
            <Button
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 12 }}
            />
          </View>
          <View style={styles.authFooter}>
            <Text style={styles.footerText}>New to ClinicCare?</Text>
            <TouchableOpacity
              onPress={() => {
                setError('');
                setScreen('register');
              }}
            >
              <Text style={styles.textLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function Register() {
    return (
      <SafeAreaView style={styles.authScreen}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <AuthHeader
            title="Create doctor account"
            subtitle="Register your professional profile."
            back={() => setScreen('login')}
          />
          {error ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.form}>
            <Field
              label="Full name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Dr. Maya Rao"
            />
            <Field
              label="Email address"
              value={email}
              onChange={setEmail}
              placeholder="doctor@cliniccare.test"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Minimum 12 characters"
              secure
            />
            <Field
              label="Medical registration number"
              value={registrationNumber}
              onChange={setRegistrationNumber}
              placeholder="REG-000001"
            />
            <Field
              label="Specialty"
              value={specialty}
              onChange={setSpecialty}
              placeholder="General Medicine"
            />
            <Field
              label="Clinic ID"
              value={clinicId}
              onChange={setClinicId}
              placeholder="UUID provided by clinic administrator"
            />
            <Button
              label="Continue"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function Otp() {
    return (
      <SafeAreaView style={styles.authScreen}>
        <View style={styles.authScroll}>
          <AuthHeader
            title="Verify it's you"
            subtitle={`Enter the 6-digit code for ${email || 'your account'}.`}
            back={() => setScreen('login')}
          />
          {error ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}
          <TextInput
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor="#A8B1BF"
            maxLength={6}
            style={styles.otpInput}
          />
          <Button
            label="Verify code"
            onPress={handleOtp}
            loading={loading}
            style={{ marginTop: 22 }}
          />
          <TouchableOpacity style={{ alignSelf: 'center', marginTop: 18 }}>
            <Text style={styles.textLink}>Resend code</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function Verification() {
    return (
      <SafeAreaView style={styles.authScreen}>
        <View style={[styles.authScroll, { justifyContent: 'center', flex: 1 }]}>
          <View style={styles.successRing}>
            <Icon name="shield" size={48} color="#2563EB" />
          </View>
          <Text style={[styles.authTitle, { textAlign: 'center', marginTop: 18 }]}>
            Verify your credentials
          </Text>
          <Text style={[styles.authSubtitle, { textAlign: 'center' }]}>
            Your identity and medical registration will be validated securely.
          </Text>
          <View style={styles.verificationCard}>
            <Icon name="check" size={18} color="#168E82" />
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationTitle}>Identity document</Text>
              <Text style={styles.verificationText}>Add during profile setup</Text>
            </View>
            <Icon name="arrow" size={18} color="#98A3B4" />
          </View>
          <View style={styles.verificationCard}>
            <Icon name="check" size={18} color="#168E82" />
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationTitle}>Medical registration</Text>
              <Text style={styles.verificationText}>
                {registrationNumber || 'Registration provided'}
              </Text>
            </View>
            <Icon name="arrow" size={18} color="#98A3B4" />
          </View>
          <Button
            label="Continue to profile"
            onPress={() => setScreen('profileSetup')}
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  function ProfileSetup() {
    return (
      <SafeAreaView style={styles.authScreen}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <AuthHeader
            title="Set up your profile"
            subtitle="A complete profile builds patient trust."
            back={() => setScreen('verification')}
          />
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {(displayName || 'Dr Maya Rao')
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </Text>
          </View>
          <View style={styles.form}>
            <Field
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Dr. Maya Rao"
            />
            <Field
              label="Phone number"
              value={profilePhone}
              onChange={setProfilePhone}
              placeholder="+91 98765 43210"
            />
            <Field
              label="Specialty"
              value={specialty}
              onChange={setSpecialty}
              placeholder="General Medicine"
            />
            <Button
              label="Save & continue"
              onPress={() => setScreen('clinicSetup')}
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function ClinicSetup() {
    return (
      <SafeAreaView style={styles.authScreen}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <AuthHeader
            title="Clinic setup"
            subtitle="Confirm where you will practise."
            back={() => setScreen('profileSetup')}
          />
          <View style={styles.form}>
            <Field
              label="Clinic name"
              value={clinicName}
              onChange={setClinicName}
              placeholder="Northstar Clinic"
            />
            <Field
              label="Clinic ID"
              value={clinicId}
              onChange={setClinicId}
              placeholder="ClinicCare clinic UUID"
            />
            <Field
              label="Address"
              value={clinicAddress}
              onChange={setClinicAddress}
              placeholder="Clinic address"
              multiline
            />
            <Button
              label="Open dashboard"
              onPress={() => setScreen('dashboard')}
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function Header({
    title,
    subtitle,
    notification = true,
  }: {
    title: string;
    subtitle?: string;
    notification?: boolean;
  }) {
    return (
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {subtitle ? <Text style={styles.headerEyebrow}>{subtitle}</Text> : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {notification ? (
          <TouchableOpacity style={styles.headerIcon} onPress={() => setScreen('notifications')}>
            <Icon name="bell" size={20} color="#64748B" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.headerAvatar} onPress={() => setScreen('profile')}>
          <Text style={styles.headerAvatarText}>
            {(profile?.displayName || displayName || 'MR')
              .split(' ')
              .map((part: string) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function AppointmentScreen() {
    const today = new Date();
    const filtered = appointments.filter((item) => {
      const date = new Date(item.startsAt);
      if (calendarMode === 'day') return date.toDateString() === today.toDateString();
      if (calendarMode === 'week') {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return date >= start && date < end;
      }
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    });
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView
          contentContainerStyle={styles.innerScroll}
          refreshControl={
            <RefreshControl
              refreshing={appointmentsLoading}
              onRefresh={() => void loadAppointments(screen === 'history')}
              tintColor="#2563EB"
            />
          }
        >
          <Header title="Appointments" subtitle="CLINIC CALENDAR" />
          <View style={styles.segmented}>
            {(['day', 'week', 'month'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.segment, calendarMode === mode ? styles.segmentActive : null]}
                onPress={() => setCalendarMode(mode)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    calendarMode === mode ? styles.segmentTextActive : null,
                  ]}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {appointmentsError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{appointmentsError}</Text>
            </View>
          ) : null}
          {appointmentsLoading && appointments.length === 0 ? (
            <StateView
              type="loading"
              title="Loading appointments"
              message="Fetching the clinic schedule."
            />
          ) : filtered.length === 0 ? (
            <StateView
              type="empty"
              title="No appointments"
              message={`No appointments are scheduled in the ${calendarMode} view.`}
            />
          ) : (
            filtered.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.appointmentCard}
                onPress={() => setSelectedAppointment(item)}
              >
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>
                    {new Date(item.startsAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentName}>
                    {item.patient
                      ? `${item.patient.firstName} ${item.patient.lastName}`
                      : 'Walk-in patient'}
                  </Text>
                  <Text style={styles.appointmentMeta}>
                    {item.isWalkIn
                      ? 'Walk-in'
                      : (item.patient?.medicalRecordNumber ?? 'Appointment')}{' '}
                    · Token {item.tokenNumber ?? '-'}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function QueueScreen() {
    const queue = appointments
      .filter((item) => ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS'].includes(item.status))
      .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView
          contentContainerStyle={styles.innerScroll}
          refreshControl={
            <RefreshControl
              refreshing={appointmentsLoading}
              onRefresh={() => void loadAppointments(false)}
              tintColor="#2563EB"
            />
          }
        >
          <Header title="Queue management" subtitle="TODAY'S PATIENTS" />
          {appointmentsError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{appointmentsError}</Text>
            </View>
          ) : null}
          {queue.length === 0 ? (
            <StateView
              type="empty"
              title="Queue is empty"
              message="Checked-in and in-progress patients will appear here."
            />
          ) : (
            queue.map((item) => (
              <View key={item.id} style={styles.queueCard}>
                <View style={styles.queueToken}>
                  <Text style={styles.queueTokenText}>{item.tokenNumber ?? '-'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentName}>
                    {item.patient
                      ? `${item.patient.firstName} ${item.patient.lastName}`
                      : 'Walk-in patient'}
                  </Text>
                  <Text style={styles.appointmentMeta}>{item.status.replace('_', ' ')}</Text>
                </View>
                {item.status === 'BOOKED' ? (
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() => void updateAppointment(item.id, 'CHECKED_IN', item.tokenNumber)}
                  >
                    <Text style={styles.smallActionText}>Check in</Text>
                  </TouchableOpacity>
                ) : null}
                {item.status === 'CHECKED_IN' ? (
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() => void updateAppointment(item.id, 'IN_PROGRESS', item.tokenNumber)}
                  >
                    <Text style={styles.smallActionText}>Start</Text>
                  </TouchableOpacity>
                ) : null}
                {item.status === 'IN_PROGRESS' ? (
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() => void updateAppointment(item.id, 'COMPLETED', item.tokenNumber)}
                  >
                    <Text style={styles.smallActionText}>Complete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function ScheduleScreen() {
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Clinic schedule" subtitle="DOCTOR SETTINGS" />
          {appointmentsError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{appointmentsError}</Text>
            </View>
          ) : null}
          <View style={styles.form}>
            <View style={styles.twoFields}>
              <Field
                label="Opening time"
                value={scheduleStart}
                onChange={setScheduleStart}
                placeholder="09:00"
              />
              <Field
                label="Closing time"
                value={scheduleEnd}
                onChange={setScheduleEnd}
                placeholder="17:00"
              />
            </View>
            <View style={styles.twoFields}>
              <Field
                label="Break start"
                value={breakStart}
                onChange={setBreakStart}
                placeholder="13:00"
              />
              <Field
                label="Break end"
                value={breakEnd}
                onChange={setBreakEnd}
                placeholder="13:30"
              />
            </View>
            <View style={styles.twoFields}>
              <Field
                label="Consultation (minutes)"
                value={consultationDuration}
                onChange={setConsultationDuration}
                keyboardType="number-pad"
              />
              <Field
                label="Follow-up (minutes)"
                value={followUpDuration}
                onChange={setFollowUpDuration}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.twoFields}>
              <Field
                label="Daily maximum"
                value={dailyMaximum}
                onChange={setDailyMaximum}
                keyboardType="number-pad"
              />
              <Field
                label="Appointment fee (₹)"
                value={appointmentFee}
                onChange={setAppointmentFee}
                keyboardType="number-pad"
              />
            </View>
            <Button label="Save schedule" onPress={() => void saveSchedule()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function HolidaysScreen() {
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Holiday management" subtitle="CLINIC CLOSURES" />
          {appointmentsError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{appointmentsError}</Text>
            </View>
          ) : null}
          <View style={styles.form}>
            <Field
              label="Holiday date (YYYY-MM-DD)"
              value={holidayDate}
              onChange={setHolidayDate}
              placeholder="2026-12-25"
            />
            <Field
              label="Holiday name"
              value={holidayName}
              onChange={setHolidayName}
              placeholder="Public holiday"
            />
            <Button label="Add holiday" onPress={() => void createHoliday()} />
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Scheduled closures</Text>
          </View>
          {holidays.length === 0 ? (
            <StateView
              type="empty"
              title="No holidays"
              message="The clinic has no scheduled closures."
            />
          ) : (
            holidays.map((holiday) => (
              <View key={holiday.id} style={styles.holidayCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentName}>{holiday.name}</Text>
                  <Text style={styles.appointmentMeta}>
                    {new Date(holiday.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => void deleteHoliday(holiday.id)}>
                  <Icon name="close" size={18} color="#C95050" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function AppointmentDetailsModal() {
    if (!selectedAppointment) return null;
    const item = selectedAppointment;
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAppointment(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment details</Text>
              <TouchableOpacity onPress={() => setSelectedAppointment(null)}>
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.appointmentName}>
              {item.patient
                ? `${item.patient.firstName} ${item.patient.lastName}`
                : 'Walk-in patient'}
            </Text>
            <Text style={styles.appointmentMeta}>
              {new Date(item.startsAt).toLocaleString('en-IN')} · Token {item.tokenNumber ?? '-'}
            </Text>
            <View style={styles.detailActions}>
              {item.status === 'BOOKED' ? (
                <Button
                  label="Accept"
                  onPress={() => {
                    void updateAppointment(item.id, 'CHECKED_IN', item.tokenNumber);
                    setSelectedAppointment(null);
                  }}
                />
              ) : null}
              {item.status === 'CHECKED_IN' && !isReceptionist ? (
                <Button
                  label="Mark waiting"
                  onPress={() => {
                    void updateAppointment(item.id, 'CHECKED_IN', item.tokenNumber);
                    setSelectedAppointment(null);
                  }}
                />
              ) : null}
              {item.status === 'CHECKED_IN' ? (
                <Button
                  label="Start consultation"
                  onPress={() => {
                    void updateAppointment(item.id, 'IN_PROGRESS', item.tokenNumber);
                    setSelectedAppointment(null);
                  }}
                />
              ) : null}
              {item.status === 'IN_PROGRESS' && !isReceptionist ? (
                <Button
                  label="Complete"
                  onPress={() => {
                    void updateAppointment(item.id, 'COMPLETED', item.tokenNumber);
                    setSelectedAppointment(null);
                  }}
                />
              ) : null}
              {item.status === 'BOOKED' || item.status === 'CHECKED_IN' ? (
                <Button
                  label="Reschedule"
                  secondary
                  onPress={() => void rescheduleAppointment(item.id)}
                />
              ) : null}
              {item.status === 'BOOKED' || item.status === 'CHECKED_IN' ? (
                <Button
                  label="No-show"
                  secondary
                  onPress={() => {
                    void updateAppointment(item.id, 'NO_SHOW', item.tokenNumber);
                    setSelectedAppointment(null);
                  }}
                />
              ) : null}
              {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' ? (
                <Button
                  label="Cancel appointment"
                  secondary
                  onPress={() => {
                    void cancelAppointment(item.id);
                    setSelectedAppointment(null);
                  }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function PatientsScreen() {
    const filters: Array<{ id: typeof patientFilter; label: string }> = [
      { id: 'all', label: 'All' },
      { id: 'new', label: 'New' },
      { id: 'returning', label: 'Returning' },
      { id: 'follow-up-due', label: 'Follow-up due' },
      { id: 'payment-pending', label: 'Payment pending' },
    ];
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView
          contentContainerStyle={styles.innerScroll}
          refreshControl={
            <RefreshControl
              refreshing={patientLoading}
              onRefresh={() => void loadPatients()}
              tintColor="#2563EB"
            />
          }
        >
          <Header title="Patients" subtitle="PATIENT CRM" />
          <View style={styles.patientSearch}>
            <Icon name="search" size={18} color="#98A3B4" />
            <TextInput
              value={patientSearch}
              onChangeText={setPatientSearch}
              onSubmitEditing={() => void loadPatients(patientSearch, patientFilter)}
              placeholder="Search name, phone or patient ID"
              placeholderTextColor="#98A3B4"
              style={styles.patientSearchInput}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  patientFilter === filter.id ? styles.filterChipActive : null,
                ]}
                onPress={() => {
                  setPatientFilter(filter.id);
                  void loadPatients(patientSearch, filter.id);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    patientFilter === filter.id ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.crmAction}
            onPress={() => {
              setPatientEditId(null);
              setActionFirstName('');
              setActionLastName('');
              setActionDate('');
              setActionPhone('');
              setActionGender('');
              setActionAddress('');
              setActionBloodGroup('');
              setActionAllergies('');
              setActionConditions('');
              setActionMedication('');
              setActionEmergencyName('');
              setActionEmergencyPhone('');
              setActionError('');
              setAction('patient');
            }}
          >
            <Icon name="plus" size={18} color="#2563EB" />
            <Text style={styles.crmActionText}>Add patient</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.duplicateLink} onPress={() => setScreen('duplicates')}>
            <Icon name="users" size={16} color="#3975DE" />
            <Text style={styles.duplicateLinkText}>Check possible duplicates</Text>
          </TouchableOpacity>
          {patientError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{patientError}</Text>
            </View>
          ) : null}
          {patientLoading ? (
            <StateView
              type="loading"
              title="Loading patients"
              message="Fetching patient records."
            />
          ) : patients.length === 0 ? (
            <StateView
              type="empty"
              title="No patients found"
              message="Adjust the search or filter to find another record."
            />
          ) : (
            patients.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={styles.patientRow}
                onPress={() => void loadPatientDetails(patient)}
              >
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>
                    {patient.firstName[0]}
                    {patient.lastName[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentName}>
                    {patient.firstName} {patient.lastName}
                  </Text>
                  <Text style={styles.appointmentMeta}>
                    {patient.medicalRecordNumber} · {patient.phone || 'No mobile'}
                  </Text>
                </View>
                <Icon name="arrow" size={17} color="#A8B1BF" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function PatientProfileScreen() {
    if (!selectedPatient)
      return (
        <>
          <SafeAreaView style={styles.appScreen}>
            <StateView
              type="empty"
              title="Patient not selected"
              message="Choose a patient from the listing."
            />
          </SafeAreaView>
          <BottomNav />
        </>
      );
    const patient = selectedPatient;
    const history = patientHistory as {
      appointments?: unknown[];
      consultations?: unknown[];
      records?: unknown[];
      prescriptions?: unknown[];
    } | null;
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Patient profile" subtitle={patient.medicalRecordNumber} />
          <View style={styles.profileCard}>
            <View style={styles.patientAvatarLarge}>
              <Text style={styles.patientAvatarTextLarge}>
                {patient.firstName[0]}
                {patient.lastName[0]}
              </Text>
            </View>
            <Text style={styles.profileName}>
              {patient.firstName} {patient.lastName}
            </Text>
            <Text style={styles.profileMeta}>{patient.medicalRecordNumber}</Text>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => {
                setPatientEditId(patient.id);
                setActionFirstName(patient.firstName);
                setActionLastName(patient.lastName);
                setActionDate(patient.dateOfBirth?.slice(0, 10) ?? '');
                setActionPhone(patient.phone ?? '');
                setActionGender(patient.gender ?? '');
                setActionAddress(patient.address ?? '');
                setActionBloodGroup(patient.bloodGroup ?? '');
                setActionAllergies(patient.allergies ?? '');
                setActionConditions(patient.medicalConditions ?? '');
                setActionMedication(patient.currentMedication ?? '');
                setActionEmergencyName(patient.emergencyContactName ?? '');
                setActionEmergencyPhone(patient.emergencyContactPhone ?? '');
                setActionError('');
                setAction('patient');
              }}
            >
              <Text style={styles.editProfileButtonText}>Edit patient</Text>
            </TouchableOpacity>
            {!isReceptionist ? (
              <TouchableOpacity
                style={[
                  styles.editProfileButton,
                  { borderColor: '#2563EB', backgroundColor: '#EDF4FF' },
                ]}
                onPress={() => void startConsultation(patient)}
              >
                <Text style={styles.editProfileButtonText}>Start consultation</Text>
              </TouchableOpacity>
            ) : null}
            {!isReceptionist ? (
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => {
                  setSelectedPatient(patient);
                  setScreen('prescriptions');
                  void loadPrescriptionHistory();
                }}
              >
                <Text style={styles.editProfileButtonText}>Prescription history</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>
              {isReceptionist ? 'Patient details' : 'Personal and clinical details'}
            </Text>
            {[
              [
                'Date of birth',
                patient.dateOfBirth
                  ? new Date(patient.dateOfBirth).toLocaleDateString('en-IN')
                  : 'Not recorded',
              ],
              ['Gender', patient.gender || 'Not recorded'],
              ['Mobile', patient.phone || 'Not recorded'],
              ['Address', patient.address || 'Not recorded'],
              ...(!isReceptionist
                ? [
                    ['Blood group', patient.bloodGroup || 'Not recorded'],
                    ['Allergies', patient.allergies || 'None recorded'],
                    ['Medical conditions', patient.medicalConditions || 'None recorded'],
                    ['Current medication', patient.currentMedication || 'None recorded'],
                  ]
                : []),
              ['Emergency contact', patient.emergencyContactName || 'Not recorded'],
              ['Emergency mobile', patient.emergencyContactPhone || 'Not recorded'],
            ].map(([label, value]) => (
              <View key={label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
          {!isReceptionist ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Patient activity timeline</Text>
              </View>
              {patientTimeline.length === 0 ? (
                <StateView
                  type="empty"
                  title="No activity yet"
                  message="Appointments, consultations and payments will appear chronologically."
                />
              ) : (
                patientTimeline.map((item) => (
                  <View key={`${item.type}-${item.id}`} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineTitle}>
                        {item.type[0].toUpperCase() + item.type.slice(1)}
                      </Text>
                      <Text style={styles.appointmentMeta}>
                        {new Date(item.occurredAt).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Clinical history</Text>
              </View>
            </>
          ) : null}
          {!isReceptionist ? (
            <View style={styles.historyGrid}>
              <View style={styles.historyCard}>
                <Text style={styles.summaryLabel}>Appointments</Text>
                <Text style={styles.historyValue}>{history?.appointments?.length ?? 0}</Text>
              </View>
              <View style={styles.historyCard}>
                <Text style={styles.summaryLabel}>Consultations</Text>
                <Text style={styles.historyValue}>{history?.consultations?.length ?? 0}</Text>
              </View>
              <View style={styles.historyCard}>
                <Text style={styles.summaryLabel}>Documents</Text>
                <Text style={styles.historyValue}>{history?.records?.length ?? 0}</Text>
              </View>
              <View style={styles.historyCard}>
                <Text style={styles.summaryLabel}>Prescriptions</Text>
                <Text style={styles.historyValue}>{history?.prescriptions?.length ?? 0}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function DuplicatesScreen() {
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Duplicate detection" subtitle="CONTROLLED MERGE" />
          {patientError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{patientError}</Text>
            </View>
          ) : null}
          {patientLoading ? (
            <StateView
              type="loading"
              title="Checking records"
              message="Comparing patient identity details."
            />
          ) : duplicates.length === 0 ? (
            <StateView
              type="empty"
              title="No duplicates found"
              message="ClinicCare found no likely matching patient records."
            />
          ) : (
            duplicates.map((group) => (
              <View
                key={group.patients.map((patient) => patient.id).join('-')}
                style={styles.duplicateCard}
              >
                <Text style={styles.cardTitle}>{group.reason}</Text>
                {group.patients.map((patient) => (
                  <View key={patient.id} style={styles.duplicatePatient}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appointmentName}>
                        {patient.firstName} {patient.lastName}
                      </Text>
                      <Text style={styles.appointmentMeta}>
                        {patient.medicalRecordNumber} · {patient.phone || 'No mobile'}
                      </Text>
                    </View>
                  </View>
                ))}
                {group.patients.length >= 2 ? (
                  <View style={styles.mergeActions}>
                    <Button
                      label={`Merge to ${group.patients[0].firstName}`}
                      onPress={() => void mergePatients(group.patients[0], group.patients[1])}
                    />
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function ConsultationScreen() {
    const steps = [
      'Overview',
      'History',
      'Symptoms',
      'Vitals',
      'Examination',
      'Diagnosis',
      'Treatment',
      'Prescription',
      'Follow-up',
      'Summary',
    ];
    if (!selectedPatient)
      return (
        <>
          <SafeAreaView style={styles.appScreen}>
            <StateView
              type="empty"
              title="No patient selected"
              message="Open a patient profile and start a consultation."
            />
          </SafeAreaView>
          <BottomNav />
        </>
      );
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Consultation" subtitle={selectedPatient.medicalRecordNumber} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.consultationSteps}
          >
            {steps.map((step, index) => (
              <TouchableOpacity
                key={step}
                style={[
                  styles.consultationStep,
                  consultationStep === index ? styles.consultationStepActive : null,
                ]}
                onPress={() => setConsultationStep(index)}
              >
                <Text
                  style={[
                    styles.consultationStepText,
                    consultationStep === index ? styles.consultationStepTextActive : null,
                  ]}
                >
                  {index + 1}. {step}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {consultationError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{consultationError}</Text>
            </View>
          ) : null}
          {consultationStep === 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Patient overview</Text>
              <Text style={styles.profileName}>
                {selectedPatient.firstName} {selectedPatient.lastName}
              </Text>
              <Text style={styles.appointmentMeta}>
                {selectedPatient.medicalRecordNumber} · {selectedPatient.phone || 'No mobile'}
              </Text>
            </View>
          ) : null}
          {consultationStep === 1 ? (
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Medical history</Text>
              <Text style={styles.infoValue}>
                {selectedPatient.medicalConditions || 'No medical conditions recorded'}
              </Text>
              <Text style={styles.infoValue}>
                {selectedPatient.allergies
                  ? `Allergies: ${selectedPatient.allergies}`
                  : 'No allergies recorded'}
              </Text>
              <Text style={styles.infoValue}>
                {selectedPatient.currentMedication
                  ? `Medication: ${selectedPatient.currentMedication}`
                  : 'No current medication recorded'}
              </Text>
            </View>
          ) : null}
          {consultationStep === 2 ? (
            <View style={styles.form}>
              {clinicalTemplates.length > 0 ? (
                <View style={styles.templateRow}>
                  {clinicalTemplates.map((template) => (
                    <TouchableOpacity
                      key={template.id}
                      style={styles.templateChip}
                      onPress={() => {
                        setConsultationSymptoms(template.symptoms ?? '');
                        setConsultationExam(template.examination ?? '');
                        setConsultationPlan(template.treatmentPlan ?? '');
                      }}
                    >
                      <Text style={styles.templateChipText}>{template.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Field
                label="Symptoms"
                value={consultationSymptoms}
                onChange={setConsultationSymptoms}
                placeholder="Describe symptoms and onset"
                multiline
              />
              <Button
                label="Save draft"
                onPress={() => void saveConsultationDraft()}
                loading={consultationLoading}
              />
            </View>
          ) : null}
          {consultationStep === 3 ? (
            <View style={styles.form}>
              <View style={styles.twoFields}>
                <Field
                  label="Blood pressure"
                  value={bloodPressure}
                  onChange={setBloodPressure}
                  placeholder="120/80"
                />
                <Field
                  label="Pulse"
                  value={pulse}
                  onChange={setPulse}
                  keyboardType="number-pad"
                  placeholder="72"
                />
              </View>
              <View style={styles.twoFields}>
                <Field
                  label="Temperature °C"
                  value={temperature}
                  onChange={setTemperature}
                  keyboardType="number-pad"
                  placeholder="36.6"
                />
                <Field
                  label="Oxygen %"
                  value={oxygen}
                  onChange={setOxygen}
                  keyboardType="number-pad"
                  placeholder="98"
                />
              </View>
              <View style={styles.twoFields}>
                <Field
                  label="Height cm"
                  value={height}
                  onChange={setHeight}
                  keyboardType="number-pad"
                />
                <Field
                  label="Weight kg"
                  value={weight}
                  onChange={setWeight}
                  keyboardType="number-pad"
                />
              </View>
              <Button
                label="Save vitals"
                onPress={() => void saveVitalsAndDiagnosis()}
                loading={consultationLoading}
              />
            </View>
          ) : null}
          {consultationStep === 4 ? (
            <View style={styles.form}>
              <Field
                label="Examination"
                value={consultationExam}
                onChange={setConsultationExam}
                placeholder="Clinical examination findings"
                multiline
              />
              <Button
                label="Save draft"
                onPress={() => void saveConsultationDraft()}
                loading={consultationLoading}
              />
            </View>
          ) : null}
          {consultationStep === 5 ? (
            <View style={styles.form}>
              <Field
                label="Diagnosis"
                value={consultationDiagnosis}
                onChange={setConsultationDiagnosis}
                placeholder="Primary diagnosis"
                multiline
              />
              <Button
                label="Save diagnosis"
                onPress={() => void saveVitalsAndDiagnosis()}
                loading={consultationLoading}
              />
            </View>
          ) : null}
          {consultationStep === 6 ? (
            <View style={styles.form}>
              <Field
                label="Treatment plan"
                value={consultationPlan}
                onChange={setConsultationPlan}
                placeholder="Treatment and instructions"
                multiline
              />
              <Button
                label="Save draft"
                onPress={() => void saveConsultationDraft()}
                loading={consultationLoading}
              />
            </View>
          ) : null}
          {consultationStep === 7 ? (
            <View style={styles.form}>
              <Field
                label="Prescription search"
                value={medicineSearch}
                onChange={(value) => void searchMedicines(value)}
                placeholder="Search medicine, generic or brand"
              />
              {medicineResults.map((medicine) => (
                <TouchableOpacity
                  key={medicine.id}
                  style={styles.medicineResult}
                  onPress={() => {
                    setPrescriptionMedicine(medicine.name);
                    setPrescriptionGeneric(medicine.genericName ?? '');
                    setPrescriptionBrand(medicine.brandName ?? '');
                    setPrescriptionStrength(medicine.strength ?? '');
                    setMedicineResults([]);
                  }}
                >
                  <Text style={styles.appointmentName}>{medicine.name}</Text>
                  <Text style={styles.appointmentMeta}>
                    {medicine.genericName ?? ''} {medicine.brandName ?? ''}{' '}
                    {medicine.strength ?? ''}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={styles.twoFields}>
                <Field
                  label="Medicine name"
                  value={prescriptionMedicine}
                  onChange={setPrescriptionMedicine}
                />
                <Field
                  label="Strength"
                  value={prescriptionStrength}
                  onChange={setPrescriptionStrength}
                />
              </View>
              <View style={styles.twoFields}>
                <Field
                  label="Generic name"
                  value={prescriptionGeneric}
                  onChange={setPrescriptionGeneric}
                />
                <Field
                  label="Brand name"
                  value={prescriptionBrand}
                  onChange={setPrescriptionBrand}
                />
              </View>
              <View style={styles.twoFields}>
                <Field
                  label="Dosage"
                  value={prescriptionDosage}
                  onChange={setPrescriptionDosage}
                  placeholder="1 tablet"
                />
                <Field
                  label="Frequency"
                  value={prescriptionFrequency}
                  onChange={setPrescriptionFrequency}
                  placeholder="Twice daily"
                />
              </View>
              <View style={styles.twoFields}>
                <Field
                  label="Duration days"
                  value={prescriptionDuration}
                  onChange={setPrescriptionDuration}
                  keyboardType="number-pad"
                />
                <Field
                  label="Quantity"
                  value={prescriptionQuantity}
                  onChange={setPrescriptionQuantity}
                  keyboardType="number-pad"
                />
              </View>
              <Field
                label="Food instructions"
                value={prescriptionFood}
                onChange={setPrescriptionFood}
                placeholder="After food"
              />
              <Field
                label="Special instructions"
                value={prescriptionSpecial}
                onChange={setPrescriptionSpecial}
                placeholder="Avoid alcohol"
              />
              <Button label="Add medicine" onPress={addPrescriptionItem} secondary />
              {prescriptionItems.map((item, index) => (
                <View key={`${item.medicineName}-${index}`} style={styles.prescriptionLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appointmentName}>
                      {item.medicineName} {item.strength ?? ''}
                    </Text>
                    <Text style={styles.appointmentMeta}>
                      {item.dosage} · {item.frequency} · {item.durationDays ?? '-'} days · Qty{' '}
                      {item.quantity ?? '-'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setPrescriptionItems((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Icon name="close" size={17} color="#C95050" />
                  </TouchableOpacity>
                </View>
              ))}
              <Field
                label="Diagnosis"
                value={prescriptionDiagnosis}
                onChange={setPrescriptionDiagnosis}
                multiline
              />
              <Field
                label="Investigation recommendations"
                value={prescriptionInvestigations}
                onChange={setPrescriptionInvestigations}
                multiline
              />
              <Field
                label="Follow-up instructions"
                value={prescriptionFollowUp}
                onChange={setPrescriptionFollowUp}
                multiline
              />
              {prescriptionError ? (
                <View style={styles.inlineError}>
                  <Text style={styles.inlineErrorText}>{prescriptionError}</Text>
                </View>
              ) : null}
              <Button
                label="Preview & issue prescription"
                onPress={() => void issuePrescription()}
                loading={prescriptionLoading}
              />
            </View>
          ) : null}
          {consultationStep === 8 ? (
            <View style={styles.form}>
              <Field
                label="Follow-up date"
                value={consultationFollowUp}
                onChange={setConsultationFollowUp}
                placeholder="2026-12-20T10:00:00.000Z"
              />
              <Button
                label="Save follow-up"
                onPress={() => void saveConsultationDraft()}
                loading={consultationLoading}
              />
            </View>
          ) : null}
          {consultationStep === 9 ? (
            <View style={styles.emrSummaryCard}>
              <Text style={styles.cardTitle}>Consultation summary</Text>
              <Text style={styles.summaryText}>
                Symptoms: {consultationSymptoms || 'Not recorded'}
              </Text>
              <Text style={styles.summaryText}>
                Vitals: {bloodPressure || 'Not recorded'} · Pulse {pulse || '-'}
              </Text>
              <Text style={styles.summaryText}>
                Examination: {consultationExam || 'Not recorded'}
              </Text>
              <Text style={styles.summaryText}>
                Diagnosis: {consultationDiagnosis || 'Not recorded'}
              </Text>
              <Text style={styles.summaryText}>
                Treatment: {consultationPlan || 'Not recorded'}
              </Text>
              <Text style={styles.summaryText}>
                Follow-up: {consultationFollowUp || 'Not scheduled'}
              </Text>
              <Button
                label={consultationLoading ? 'Finalising...' : 'Finalise consultation'}
                onPress={() => void finalizeConsultation()}
                loading={consultationLoading}
                style={{ marginTop: 16 }}
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function PrescriptionsScreen() {
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Prescriptions" subtitle="DIGITAL RX" />
          {prescriptionError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{prescriptionError}</Text>
            </View>
          ) : null}
          {prescriptionPreview ? (
            <View style={styles.prescriptionPreview}>
              <View style={styles.prescriptionPreviewHeader}>
                <View>
                  <Text style={styles.prescriptionClinic}>{prescriptionPreview.clinic.name}</Text>
                  <Text style={styles.prescriptionDoctor}>
                    Dr. {prescriptionPreview.doctor.name}
                  </Text>
                  <Text style={styles.appointmentMeta}>
                    Reg. {prescriptionPreview.doctor.registrationNumber}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.prescriptionNumber}>
                    {prescriptionPreview.prescriptionNumber}
                  </Text>
                  <Text style={styles.appointmentMeta}>
                    {new Date(prescriptionPreview.issuedAt).toLocaleDateString('en-IN')} · v
                    {prescriptionPreview.version}
                  </Text>
                </View>
              </View>
              <View style={styles.prescriptionPatient}>
                <Text style={styles.appointmentName}>{prescriptionPreview.patient.name}</Text>
                <Text style={styles.appointmentMeta}>
                  {prescriptionPreview.patient.id} · {prescriptionPreview.patient.phone || '-'}
                </Text>
              </View>
              {prescriptionPreview.diagnosis ? (
                <View style={styles.prescriptionSection}>
                  <Text style={styles.cardTitle}>Diagnosis</Text>
                  <Text style={styles.summaryText}>{prescriptionPreview.diagnosis}</Text>
                </View>
              ) : null}
              {prescriptionPreview.items.map((item, index) => (
                <View key={`${item.medicineName}-${index}`} style={styles.prescriptionPreviewLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appointmentName}>
                      {index + 1}. {item.medicineName} {item.strength ?? ''}
                    </Text>
                    <Text style={styles.appointmentMeta}>
                      {item.genericName ?? ''} {item.brandName ?? ''}
                    </Text>
                  </View>
                  <Text style={styles.prescriptionDose}>
                    {item.dosage} · {item.frequency}
                  </Text>
                </View>
              ))}
              {prescriptionPreview.investigationRecommendations ? (
                <View style={styles.prescriptionSection}>
                  <Text style={styles.cardTitle}>Investigations</Text>
                  <Text style={styles.summaryText}>
                    {prescriptionPreview.investigationRecommendations}
                  </Text>
                </View>
              ) : null}
              {prescriptionPreview.followUpInstructions ? (
                <View style={styles.prescriptionSection}>
                  <Text style={styles.cardTitle}>Follow-up</Text>
                  <Text style={styles.summaryText}>{prescriptionPreview.followUpInstructions}</Text>
                </View>
              ) : null}
              <View style={styles.verificationRow}>
                <View>
                  <Text style={styles.appointmentMeta}>Verification code</Text>
                  <Text style={styles.verificationCode}>
                    {prescriptionPreview.verificationCode}
                  </Text>
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureText}>
                    {prescriptionPreview.signed ? 'Digitally signed' : 'Doctor signature'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <StateView
              type="empty"
              title="No prescription preview"
              message="Issue a prescription from the consultation builder."
            />
          )}
          {prescriptionPreview ? (
            <>
              <View style={styles.actionRow}>
                <Button
                  label="Print"
                  onPress={() => void downloadOrPrintPrescription(prescriptionPreview, 'print')}
                  secondary
                  style={{ flex: 1 }}
                />
                <Button
                  label="Share PDF"
                  onPress={() => void downloadOrPrintPrescription(prescriptionPreview, 'share')}
                  style={{ flex: 1 }}
                />
              </View>
              <Field
                label="Controlled correction reason"
                value={prescriptionCorrectionReason}
                onChange={setPrescriptionCorrectionReason}
                placeholder="Minimum 5 characters"
              />
              <Button
                label="Issue controlled correction"
                onPress={() => void correctPrescription(prescriptionPreview.id)}
                loading={prescriptionLoading}
                secondary
              />
            </>
          ) : null}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Prescription history</Text>
            <TouchableOpacity onPress={() => void loadPrescriptionHistory()}>
              <Text style={styles.textLink}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {prescriptionLoading ? (
            <StateView
              type="loading"
              title="Loading prescriptions"
              message="Fetching prescription history."
            />
          ) : (
            prescriptionHistory.map((prescription) => (
              <View key={prescription.id} style={styles.prescriptionHistoryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentName}>{prescription.prescriptionNumber}</Text>
                  <Text style={styles.appointmentMeta}>
                    {new Date(prescription.issuedAt).toLocaleDateString('en-IN')} · v
                    {prescription.version} · {prescription.status}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallAction}
                  onPress={() => void openPrescriptionPreview(prescription.id)}
                >
                  <Text style={styles.smallActionText}>Preview</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function ReceptionDashboardScreen() {
    const waiting = appointments.filter((item) => item.status === 'CHECKED_IN').length;
    const booked = appointments.filter((item) => item.status === 'BOOKED').length;
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView
          contentContainerStyle={styles.innerScroll}
          refreshControl={
            <RefreshControl
              refreshing={dashboardLoading}
              onRefresh={() => void loadDashboard()}
              tintColor="#2563EB"
            />
          }
        >
          <Header title={profile?.displayName || 'Reception'} subtitle="CLINIC OPERATIONS" />
          {dashboardError ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{dashboardError}</Text>
            </View>
          ) : null}
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Today’s bookings"
              value={String(booked)}
              icon="calendar"
              tone="blue"
            />
            <MetricCard
              title="Waiting patients"
              value={String(waiting)}
              icon="clock"
              tone="violet"
            />
            <MetricCard title="Patients" value={String(patients.length)} icon="users" tone="teal" />
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                setAction('patient');
                setScreen('patients');
              }}
            >
              <Icon name="users" size={22} color="#2563EB" />
              <Text style={styles.quickActionText}>Register patient</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                setAction('appointment');
                setScreen('appointments');
              }}
            >
              <Icon name="calendar" size={22} color="#2563EB" />
              <Text style={styles.quickActionText}>Add appointment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => setScreen('queue')}>
              <Icon name="clock" size={22} color="#2563EB" />
              <Text style={styles.quickActionText}>Manage queue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => setAction('payment')}>
              <Icon name="reports" size={22} color="#2563EB" />
              <Text style={styles.quickActionText}>Collect payment</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today’s appointments</Text>
            <Text style={styles.sectionMeta}>{appointments.length} total</Text>
          </View>
          {appointments.length === 0 ? (
            <StateView
              type="empty"
              title="No appointments"
              message="New bookings will appear here."
            />
          ) : (
            appointments.slice(0, 8).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.appointmentCard}
                onPress={() => {
                  setSelectedAppointment(item);
                  setScreen('appointments');
                }}
              >
                <Text style={styles.appointmentName}>
                  {item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : 'Patient'}
                </Text>
                <Text style={styles.appointmentMeta}>
                  {new Date(item.startsAt).toLocaleString('en-IN')} · {item.status}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function DashboardScreen() {
    const metrics = dashboard?.metrics;
    const chart = dashboard?.charts.incomeVsExpenses ?? [];
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView
          contentContainerStyle={styles.dashboardScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadDashboard();
              }}
              tintColor="#2563EB"
            />
          }
        >
          <Header
            title={profile?.displayName || displayName || 'Dr. Maya Rao'}
            subtitle="GOOD MORNING"
          />
          {dashboardLoading && !dashboard ? (
            <StateView
              type="loading"
              title="Loading practice data"
              message="Fetching the latest information from ClinicCare."
            />
          ) : dashboardError && !dashboard ? (
            <StateView
              type="error"
              title="Unable to load dashboard"
              message={dashboardError}
              onRetry={loadDashboard}
            />
          ) : !dashboard ? (
            <StateView
              type="empty"
              title="No dashboard data"
              message="There is no practice activity to show yet."
            />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickActions}
              >
                {(
                  [
                    ['Add patient', 'plus', 'patient'],
                    ['Book appointment', 'calendar', 'appointment'],
                    ['Start consultation', 'consultation', 'consultation'],
                    ['Create prescription', 'prescription', 'prescription'],
                    ['Add expense', 'expense', 'expense'],
                    ['View reports', 'reports', 'reports'],
                  ] as [string, IconName, typeof action][]
                ).map(([label, icon, key]) => (
                  <TouchableOpacity
                    key={label}
                    style={styles.quickAction}
                    onPress={() => {
                      setActionError('');
                      setAction(key);
                    }}
                  >
                    <View style={styles.quickActionIcon}>
                      <Icon name={icon} size={18} color="#3975DE" />
                    </View>
                    <Text style={styles.quickActionText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={[styles.metricsGrid, compact ? { gap: 8 } : null]}>
                <MetricCard
                  title="Total patients"
                  value={String(metrics?.totalPatients ?? 0)}
                  icon="users"
                  tone="blue"
                />
                <MetricCard
                  title="New patients"
                  value={String(metrics?.newPatients ?? 0)}
                  icon="users"
                  tone="teal"
                />
                <MetricCard
                  title="Today's appointments"
                  value={String(metrics?.todaysAppointments ?? 0)}
                  icon="calendar"
                  tone="violet"
                />
                <MetricCard
                  title="Upcoming"
                  value={String(metrics?.upcomingAppointments ?? 0)}
                  icon="clock"
                  tone="amber"
                />
                <MetricCard
                  title="Completed"
                  value={String(metrics?.completedAppointments ?? 0)}
                  icon="check"
                  tone="teal"
                />
                <MetricCard
                  title="Cancelled"
                  value={String(metrics?.cancelledAppointments ?? 0)}
                  icon="close"
                  tone="amber"
                />
              </View>

              <View style={styles.financeRow}>
                <View style={styles.financeCard}>
                  <Text style={styles.financeLabel}>Today's collections</Text>
                  <Text style={styles.financeValue}>
                    ₹{Number(metrics?.todayCollections ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.financeCard}>
                  <Text style={styles.financeLabel}>Monthly collections</Text>
                  <Text style={styles.financeValue}>
                    ₹{Number(metrics?.monthlyCollections ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Pending payments</Text>
                  <Text style={styles.summaryValue}>
                    ₹{Number(metrics?.pendingPayments ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Monthly expenses</Text>
                  <Text style={[styles.summaryValue, { color: '#C95050' }]}>
                    ₹{Number(metrics?.monthlyExpenses ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Net surplus</Text>
                  <Text style={[styles.summaryValue, { color: '#168E82' }]}>
                    ₹{Number(metrics?.netOperatingSurplus ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming appointments</Text>
                <Text style={styles.sectionMeta}>{appointments.length} scheduled</Text>
              </View>
              {appointments.length === 0 ? (
                <StateView
                  type="empty"
                  title="No upcoming appointments"
                  message="New bookings will appear here."
                />
              ) : (
                appointments.map((item) => (
                  <View key={item.id} style={styles.appointmentCard}>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>
                        {new Date(item.startsAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appointmentName}>
                        {item.patient
                          ? `${item.patient.firstName} ${item.patient.lastName}`
                          : 'Patient'}
                      </Text>
                      <Text style={styles.appointmentMeta}>
                        {item.patient?.medicalRecordNumber ?? 'Clinic appointment'}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                    </View>
                  </View>
                ))
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Practice insights</Text>
              </View>
              <MiniChart
                title="Monthly income"
                points={dashboard?.charts.monthlyIncome ?? []}
                type="income"
              />
              <MiniChart
                title="Appointment trends"
                points={dashboard?.charts.appointmentTrends ?? []}
                type="appointments"
              />
              <MiniChart
                title="Patient growth"
                points={dashboard?.charts.patientGrowth ?? []}
                type="growth"
              />
              <MiniChart title="Income versus expenses" points={chart} type="comparison" />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function NotificationsScreen() {
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Notifications" subtitle="YOUR CLINIC" />
          {notifications.length === 0 ? (
            <StateView
              type="empty"
              title="You're all caught up"
              message="There are no notifications waiting for you."
            />
          ) : (
            notifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.notificationCard, item.readAt ? null : styles.notificationUnread]}
                onPress={async () => {
                  if (!token || item.readAt) return;
                  try {
                    await api(`/notifications/${item.id}/read`, token, {
                      method: 'PUT',
                      body: '{}',
                    });
                    await loadNotifications();
                  } catch (caught) {
                    setError(
                      caught instanceof Error ? caught.message : 'Unable to update notification',
                    );
                  }
                }}
              >
                <View style={styles.notificationIcon}>
                  <Icon name="bell" size={18} color="#3975DE" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notificationSubject}>
                    {item.subject || 'ClinicCare update'}
                  </Text>
                  <Text style={styles.notificationBody}>{item.body}</Text>
                  <Text style={styles.notificationTime}>
                    {new Date(item.createdAt).toLocaleString('en-IN')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function ProfileScreen() {
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Profile" subtitle="YOUR ACCOUNT" />
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {(profile?.displayName || displayName || 'MR')
                  .split(' ')
                  .map((part: string) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>
              {profile?.displayName || displayName || (isReceptionist ? 'Receptionist' : 'Doctor')}
            </Text>
            <Text style={styles.profileMeta}>
              {profile?.email || email || 'Connected ClinicCare account'}
            </Text>
          </View>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('profileSetup')}>
              <Icon name="profile" size={19} color="#64748B" />
              <Text style={styles.menuText}>Personal information</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
            {!isReceptionist ? (
              <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('clinicSetup')}>
                <Icon name="heart" size={19} color="#64748B" />
                <Text style={styles.menuText}>Clinic information</Text>
                <Icon name="arrow" size={17} color="#A8B1BF" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('patients')}>
              <Icon name="users" size={19} color="#64748B" />
              <Text style={styles.menuText}>Patient CRM</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('queue')}>
              <Icon name="users" size={19} color="#64748B" />
              <Text style={styles.menuText}>Queue management</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
            {!isReceptionist ? (
              <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('schedule')}>
                <Icon name="calendar" size={19} color="#64748B" />
                <Text style={styles.menuText}>Clinic schedule</Text>
                <Icon name="arrow" size={17} color="#A8B1BF" />
              </TouchableOpacity>
            ) : null}
            {!isReceptionist ? (
              <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('holidays')}>
                <Icon name="calendar" size={19} color="#64748B" />
                <Text style={styles.menuText}>Holiday management</Text>
                <Icon name="arrow" size={17} color="#A8B1BF" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('history')}>
              <Icon name="clock" size={19} color="#64748B" />
              <Text style={styles.menuText}>Appointment history</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => setScreen('settings')}>
              <Icon name="settings" size={19} color="#64748B" />
              <Text style={styles.menuText}>Account settings</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function SettingsScreen() {
    const [mfa, setMfa] = useState(true);
    const [biometric, setBiometric] = useState(false);
    return (
      <SafeAreaView style={styles.appScreen}>
        <ScrollView contentContainerStyle={styles.innerScroll}>
          <Header title="Settings" subtitle="PREFERENCES" />
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuRow} onPress={() => setMfa(!mfa)}>
              <Icon name="shield" size={19} color="#64748B" />
              <Text style={styles.menuText}>Two-step verification</Text>
              <View style={[styles.toggle, mfa ? styles.toggleActive : null]}>
                <View style={[styles.toggleKnob, mfa ? styles.toggleKnobActive : null]} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => setBiometric(!biometric)}>
              <Icon name="shield" size={19} color="#64748B" />
              <Text style={styles.menuText}>Biometric sign-in</Text>
              <View style={[styles.toggle, biometric ? styles.toggleActive : null]}>
                <View style={[styles.toggleKnob, biometric ? styles.toggleKnobActive : null]} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() =>
                setError('Session settings are managed through your ClinicCare account.')
              }
            >
              <Icon name="settings" size={19} color="#64748B" />
              <Text style={styles.menuText}>Privacy and security</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setError('ClinicCare support: support@cliniccare.test')}
            >
              <Icon name="bell" size={19} color="#64748B" />
              <Text style={styles.menuText}>Help and support</Text>
              <Icon name="arrow" size={17} color="#A8B1BF" />
            </TouchableOpacity>
          </View>
          <Button label="Sign out" onPress={logout} secondary style={{ marginTop: 18 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  function BottomNav() {
    const items: { label: string; icon: IconName; target: Screen }[] = [
      { label: 'Home', icon: 'home', target: 'dashboard' },
      { label: 'Appointments', icon: 'calendar', target: 'appointments' },
      { label: 'Patients', icon: 'users', target: 'patients' },
      { label: 'Notifications', icon: 'bell', target: 'notifications' },
      { label: 'Profile', icon: 'profile', target: 'profile' },
    ];
    return (
      <View style={styles.bottomNav}>
        {items.map((item) => {
          const active =
            item.target === screen || (item.target === 'dashboard' && screen === 'dashboard');
          return (
            <TouchableOpacity
              key={item.label}
              style={styles.navItem}
              onPress={() => setScreen(item.target)}
            >
              <Icon name={item.icon} size={20} color={active ? '#2563EB' : '#99A4B4'} />
              <Text style={[styles.navText, active ? styles.navTextActive : null]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function ActionModal() {
    if (!action) return null;
    const title =
      action === 'patient'
        ? patientEditId
          ? 'Edit patient'
          : 'Add patient'
        : action === 'appointment'
          ? 'Book appointment'
          : action === 'consultation'
            ? 'Start consultation'
            : action === 'prescription'
              ? 'Create prescription'
              : action === 'expense'
                ? 'Add expense'
                : action === 'payment'
                  ? 'Collect payment'
                  : 'Practice reports';
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setAction(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setAction(null)}>
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {actionError ? (
                <View style={styles.inlineError}>
                  <Text style={styles.inlineErrorText}>{actionError}</Text>
                </View>
              ) : null}
              {action === 'patient' ? (
                <>
                  <Field label="First name" value={actionFirstName} onChange={setActionFirstName} />
                  <Field label="Last name" value={actionLastName} onChange={setActionLastName} />
                  <Field
                    label="Date of birth (YYYY-MM-DD)"
                    value={actionDate}
                    onChange={setActionDate}
                    placeholder="1990-01-01"
                  />
                  <Field
                    label="Gender"
                    value={actionGender}
                    onChange={setActionGender}
                    placeholder="Female"
                  />
                  <Field
                    label="Mobile"
                    value={actionPhone}
                    onChange={setActionPhone}
                    placeholder="+91 98765 43210"
                  />
                  <Field
                    label="Address"
                    value={actionAddress}
                    onChange={setActionAddress}
                    multiline
                  />
                  <Field
                    label="Blood group"
                    value={actionBloodGroup}
                    onChange={setActionBloodGroup}
                    placeholder="O+"
                  />
                  <Field
                    label="Allergies"
                    value={actionAllergies}
                    onChange={setActionAllergies}
                    multiline
                  />
                  <Field
                    label="Medical conditions"
                    value={actionConditions}
                    onChange={setActionConditions}
                    multiline
                  />
                  <Field
                    label="Current medication"
                    value={actionMedication}
                    onChange={setActionMedication}
                    multiline
                  />
                  <Field
                    label="Emergency contact name"
                    value={actionEmergencyName}
                    onChange={setActionEmergencyName}
                  />
                  <Field
                    label="Emergency contact phone"
                    value={actionEmergencyPhone}
                    onChange={setActionEmergencyPhone}
                  />
                </>
              ) : null}
              {action === 'appointment' ? (
                <>
                  <Field
                    label="Patient ID"
                    value={actionPatientId}
                    onChange={setActionPatientId}
                    placeholder="Patient UUID"
                  />
                  <Field
                    label="Start date/time"
                    value={actionDate}
                    onChange={setActionDate}
                    placeholder="2026-11-22T09:30:00.000Z"
                  />
                </>
              ) : null}
              {action === 'consultation' || action === 'prescription' ? (
                <>
                  <Field
                    label="Patient ID"
                    value={actionPatientId}
                    onChange={setActionPatientId}
                    placeholder="Patient UUID"
                  />
                  <Field
                    label="Clinical notes"
                    value={actionText}
                    onChange={setActionText}
                    multiline
                  />
                </>
              ) : null}
              {action === 'prescription' ? (
                <>
                  <Field
                    label="Medicine"
                    value={actionCategory}
                    onChange={setActionCategory}
                    placeholder="Amoxicillin"
                  />
                  <Field
                    label="Dosage"
                    value={actionAmount}
                    onChange={setActionAmount}
                    placeholder="500 mg"
                  />
                  <Field
                    label="Frequency"
                    value={actionDescription}
                    onChange={setActionDescription}
                    placeholder="Twice daily"
                  />
                </>
              ) : null}
              {action === 'expense' ? (
                <>
                  <Field
                    label="Amount (INR)"
                    value={actionAmount}
                    onChange={setActionAmount}
                    keyboardType="number-pad"
                  />
                  <Field
                    label="Category"
                    value={actionCategory}
                    onChange={setActionCategory}
                    placeholder="MEDICAL_SUPPLIES (or RENT, ELECTRICITY, STAFF_SALARY, INTERNET, EQUIPMENT, MAINTENANCE, MARKETING, OTHER)"
                  />
                  <Field
                    label="Description"
                    value={actionDescription}
                    onChange={setActionDescription}
                    multiline
                  />
                </>
              ) : null}
              {action === 'payment' ? (
                <>
                  <Field
                    label="Patient ID"
                    value={actionPatientId}
                    onChange={setActionPatientId}
                    placeholder="Patient UUID"
                  />
                  <Field
                    label="Amount (INR)"
                    value={actionAmount}
                    onChange={setActionAmount}
                    keyboardType="number-pad"
                  />
                  <Field
                    label="Service category"
                    value={actionCategory}
                    onChange={setActionCategory}
                    placeholder="NEW_CONSULTATION, FOLLOW_UP, ONLINE_CONSULTATION, PROCEDURE or OTHER_SERVICES"
                  />
                  <Text style={styles.appointmentMeta}>
                    Cash collection will be verified and a receipt generated immediately.
                  </Text>
                </>
              ) : null}
              {action === 'reports' ? (
                <View style={styles.reportPreview}>
                  <Icon name="reports" size={32} color="#2563EB" />
                  <Text style={styles.reportPreviewText}>
                    Monthly reports are generated from ClinicCare income and expense data.
                  </Text>
                </View>
              ) : null}
              {action !== 'reports' ? (
                <Button
                  label={actionLoading ? 'Please wait...' : 'Save'}
                  onPress={executeAction}
                  loading={actionLoading}
                  style={{ marginTop: 10 }}
                />
              ) : (
                <Button label="Done" onPress={() => setAction(null)} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {screen === 'splash' ? (
        <SafeAreaView style={styles.splash}>
          <Brand />
          <Text style={styles.splashText}>CLINIC WORKSPACE</Text>
          <ActivityIndicator color="#2563EB" style={{ marginTop: 32 }} />
        </SafeAreaView>
      ) : screen === 'onboarding' ? (
        <Onboarding />
      ) : screen === 'login' ? (
        <Login />
      ) : screen === 'register' ? (
        <Register />
      ) : screen === 'otp' ? (
        <Otp />
      ) : screen === 'verification' ? (
        <Verification />
      ) : screen === 'profileSetup' ? (
        <ProfileSetup />
      ) : screen === 'clinicSetup' ? (
        <ClinicSetup />
      ) : screen === 'dashboard' ? (
        <>
          {isReceptionist ? <ReceptionDashboardScreen /> : <DashboardScreen />}
          <BottomNav />
        </>
      ) : screen === 'appointments' || screen === 'history' ? (
        <>
          <AppointmentScreen />
          <BottomNav />
        </>
      ) : screen === 'queue' ? (
        <>
          <QueueScreen />
          <BottomNav />
        </>
      ) : screen === 'schedule' ? (
        <>
          <ScheduleScreen />
          <BottomNav />
        </>
      ) : screen === 'holidays' ? (
        <>
          <HolidaysScreen />
          <BottomNav />
        </>
      ) : screen === 'patients' ? (
        <>
          <PatientsScreen />
          <BottomNav />
        </>
      ) : screen === 'patientProfile' ? (
        <>
          <PatientProfileScreen />
          <BottomNav />
        </>
      ) : screen === 'duplicates' ? (
        <>
          <DuplicatesScreen />
          <BottomNav />
        </>
      ) : screen === 'consultation' ? (
        <>
          <ConsultationScreen />
          <BottomNav />
        </>
      ) : screen === 'prescriptions' ? (
        <>
          <PrescriptionsScreen />
          <BottomNav />
        </>
      ) : screen === 'notifications' ? (
        <>
          <NotificationsScreen />
          <BottomNav />
        </>
      ) : screen === 'profile' ? (
        <>
          <ProfileScreen />
          <BottomNav />
        </>
      ) : (
        <>
          <SettingsScreen />
          <BottomNav />
        </>
      )}
      <ActionModal />
      <AppointmentDetailsModal />
    </View>
  );
}
