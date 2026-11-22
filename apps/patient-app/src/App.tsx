import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const ACCESS_KEY = 'cliniccare_patient_access';
const REFRESH_KEY = 'cliniccare_patient_refresh';

type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'otp'
  | 'register'
  | 'profileSetup'
  | 'home'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'booking'
  | 'appointments'
  | 'prescriptions'
  | 'records'
  | 'medicine'
  | 'consultations'
  | 'family'
  | 'sharing';
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  medicalRecordNumber: string;
  phone?: string;
  dateOfBirth: string;
  allergies?: string;
  currentMedication?: string;
  medicalConditions?: string;
};
type Consultation = {
  id: string;
  startedAt: string;
  clinicalNotes?: string;
  treatmentPlan?: string;
  status: string;
};
type FamilyMember = { id: string; name: string; relationship: string; phone?: string };
type Consent = {
  id: string;
  consentType: string;
  version: string;
  grantedAt: string;
  revokedAt?: string | null;
};
type Doctor = {
  id: string;
  specialty?: string;
  clinicHoursStart: string;
  clinicHoursEnd: string;
  consultationDuration: number;
  appointmentFee: string | number;
  user: { displayName: string };
  clinic?: { name: string; timezone: string };
};
type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  tokenNumber?: number;
  fee?: string | number;
  doctor?: { id: string; user: { displayName: string }; specialty?: string };
};
type Payment = {
  id: string;
  appointmentId?: string | null;
  status: string;
  amount: string | number;
  receipt?: { receiptNumber: string; issuedAt: string } | null;
};
type Prescription = {
  id: string;
  prescriptionNumber: string;
  issuedAt: string;
  items: Array<{ medicineName: string; dosage: string; frequency: string }>;
};
type RecordItem = { id: string; title: string; type: string; createdAt: string };
type Notice = {
  id: string;
  subject?: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
};
type Slot = { startsAt: string; endsAt: string };
type Medicine = {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
};
function idempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

async function request<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body?.error?.message ?? body?.message ?? 'Something went wrong');
  return body.data as T;
}

function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  secure = false,
  keyboard = 'default',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
        style={styles.input}
      />
    </View>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
    </View>
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loadingHome, setLoadingHome] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reportTitle, setReportTitle] = useState('');
  const [reportStorageKey, setReportStorageKey] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyRelationship, setFamilyRelationship] = useState('');

  const activeDoctor = selectedDoctor ?? doctors[0] ?? null;
  const upcoming = useMemo(
    () =>
      appointments
        .filter((item) => new Date(item.startsAt) >= new Date() && item.status !== 'CANCELLED')
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [appointments],
  );

  useEffect(() => {
    void boot();
  }, []);
  useEffect(() => {
    if (token && screen === 'home') void loadHome();
  }, [token, screen]);

  async function boot() {
    try {
      const [storedAccess, storedRefresh] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      setToken(storedAccess);
      setRefreshToken(storedRefresh);
      setScreen(storedAccess ? 'home' : 'onboarding');
    } catch {
      setScreen('onboarding');
    }
  }
  async function saveSession(access: string, refresh?: string) {
    setToken(access);
    setRefreshToken(refresh ?? null);
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  }
  async function loadHome() {
    if (!token) return;
    setLoadingHome(true);
    setError('');
    try {
      const [patientPage, doctorPage, appointmentPage, prescriptionPage, recordPage, noticePage] =
        await Promise.all([
          request<Page<Patient>>('/patients?page=1&pageSize=5', token),
          request<Page<Doctor>>('/doctors?page=1&pageSize=20', token),
          request<Page<Appointment>>('/appointments?page=1&pageSize=50&sortOrder=desc', token),
          request<Page<Prescription>>('/prescriptions?page=1&pageSize=5', token),
          request<Page<RecordItem>>('/medical-records?page=1&pageSize=5', token),
          request<Page<Notice>>('/notifications?page=1&pageSize=20', token),
        ]);
      const [consultationPage, familyRows, consentRows] = await Promise.all([
        request<Page<Consultation>>('/consultations?page=1&pageSize=20', token),
        request<FamilyMember[]>('/patient-sharing/family', token).catch(() => []),
        request<Consent[]>('/patient-sharing/consents', token).catch(() => []),
      ]);
      const paymentRows = await request<Payment[]>('/payments/mine', token).catch(() => []);
      const profile = patientPage.items[0] ?? null;
      setPatient(profile);
      setDoctors(doctorPage.items);
      setAppointments(appointmentPage.items);
      setPrescriptions(prescriptionPage.items);
      setRecords(recordPage.items);
      setConsultations(consultationPage.items);
      setFamily(familyRows);
      setConsents(consentRows);
      setNotices(noticePage.items);
      setPayments(paymentRows);
      if (profile && !profile.phone) {
        setPhone('');
        setScreen('profileSetup');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your health information');
    } finally {
      setLoadingHome(false);
    }
  }
  async function login() {
    setBusy(true);
    setError('');
    try {
      const result = await request<{
        accessToken?: string;
        refreshToken?: string;
        mfaRequired?: boolean;
        challengeId?: string;
      }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceName: 'ClinicCare Patient App' }),
      });
      if (result.mfaRequired && result.challengeId) {
        setChallengeId(result.challengeId);
        setScreen('otp');
      } else if (result.accessToken) {
        await saveSession(result.accessToken, result.refreshToken);
        setScreen('home');
      } else throw new Error('Authentication response was incomplete');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  async function verifyOtp() {
    setBusy(true);
    setError('');
    try {
      const result = await request<{ accessToken: string; refreshToken?: string }>(
        '/auth/otp/verify',
        null,
        {
          method: 'POST',
          body: JSON.stringify({ challengeId, code: otp, deviceName: 'ClinicCare Patient App' }),
        },
      );
      await saveSession(result.accessToken, result.refreshToken);
      setScreen('home');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }
  async function register() {
    setBusy(true);
    setError('');
    try {
      await request('/auth/register/patient', null, {
        method: 'POST',
        body: JSON.stringify({
          clinicId,
          email,
          password,
          displayName: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          dateOfBirth,
          phone: phone || undefined,
        }),
      });
      setScreen('login');
      Alert.alert('Account created', 'Sign in to complete your profile.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }
  async function updateProfile() {
    if (!token || !patient) return;
    setBusy(true);
    setError('');
    try {
      await request(`/patients/${patient.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ phone }),
      });
      await loadHome();
      setScreen('home');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your profile');
    } finally {
      setBusy(false);
    }
  }
  async function loadSlots(doctor: Doctor = activeDoctor as Doctor) {
    if (!token || !doctor) return;
    setBusy(true);
    setError('');
    setSelectedSlot(null);
    try {
      const result = await request<{ slots: Slot[] }>(
        `/appointments/availability?doctorId=${doctor.id}&date=${bookingDate}`,
        token,
      );
      setSlots(result.slots);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load available times');
    } finally {
      setBusy(false);
    }
  }
  async function bookAppointment() {
    if (!token || !patient || !activeDoctor || !selectedSlot) return;
    setBusy(true);
    setError('');
    try {
      if (rescheduleTarget) {
        await request(`/appointments/${rescheduleTarget.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({ startsAt: selectedSlot.startsAt, endsAt: selectedSlot.endsAt }),
        });
      } else {
        await request<Appointment>('/appointments', token, {
          method: 'POST',
          body: JSON.stringify({
            patientId: patient.id,
            doctorId: activeDoctor.id,
            startsAt: selectedSlot.startsAt,
            endsAt: selectedSlot.endsAt,
          }),
        });
      }
      setRescheduleTarget(null);
      setScreen('appointments');
      await loadHome();
      Alert.alert(
        rescheduleTarget ? 'Appointment rescheduled' : 'Booking confirmed',
        `Your appointment is scheduled for ${formatDate(selectedSlot.startsAt)}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to book your appointment');
    } finally {
      setBusy(false);
    }
  }
  async function cancelAppointment(appointment: Appointment) {
    if (!token) return;
    setBusy(true);
    try {
      await request(`/appointments/${appointment.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      await loadHome();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel the appointment');
    } finally {
      setBusy(false);
    }
  }
  function beginReschedule(appointment: Appointment) {
    const doctor = doctors.find((item) => item.id === appointment.doctor?.id) ?? null;
    setSelectedDoctor(doctor);
    setBookingDate(appointment.startsAt.slice(0, 10));
    setSlots([]);
    setSelectedSlot(null);
    setRescheduleTarget(appointment);
    setScreen('booking');
  }
  function beginFollowUp(appointment: Appointment) {
    const doctor = doctors.find((item) => item.id === appointment.doctor?.id) ?? null;
    setSelectedDoctor(doctor);
    setBookingDate(new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString().slice(0, 10));
    setSlots([]);
    setSelectedSlot(null);
    setRescheduleTarget(null);
    setScreen('booking');
  }
  async function payForAppointment(appointment: Appointment) {
    if (!token || !patient) return;
    setBusy(true);
    setError('');
    try {
      const pending = await request<{ id: string }>('/payments', token, {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          appointmentId: appointment.id,
          amount: Number(appointment.fee ?? 0),
          method: 'ONLINE',
          serviceCategory: 'NEW_CONSULTATION',
          idempotencyKey: idempotencyKey(),
        }),
      });
      const verified = await request<{ receipt?: { receiptNumber?: string } }>(
        `/payments/${pending.id}/verify`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ providerTransactionId: `PATIENT-${Date.now()}` }),
        },
      );
      await loadHome();
      Alert.alert('Payment confirmed', `Receipt: ${verified.receipt?.receiptNumber ?? pending.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to process payment');
    } finally {
      setBusy(false);
    }
  }
  async function searchMedicine(value: string) {
    setMedicineSearch(value);
    if (!token) return;
    try {
      setMedicines(
        await request<Medicine[]>(
          `/prescriptions/search-medicines?search=${encodeURIComponent(value)}`,
          token,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Medicine search is unavailable');
    }
  }
  async function markRead(id: string) {
    if (!token) return;
    try {
      await request(`/notifications/${id}/read`, token, { method: 'PUT' });
      setNotices((items) =>
        items.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    } catch {
      setError('Unable to update notification');
    }
  }
  async function logout() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
    setToken(null);
    setRefreshToken(null);
    setScreen('login');
  }

  const Header = ({
    title,
    subtitle,
    back,
  }: {
    title: string;
    subtitle?: string;
    back?: Screen;
  }) => (
    <View style={styles.header}>
      <View>
        {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={styles.headerActions}>
        {back ? (
          <TouchableOpacity onPress={() => setScreen(back)}>
            <Text style={styles.headerLink}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setScreen('notifications')}>
          <Text style={styles.headerLink}>Alerts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  const Navigation = () => (
    <View style={styles.nav}>
      {(
        [
          ['home', 'Home'],
          ['appointments', 'Appointments'],
          ['prescriptions', 'Prescriptions'],
          ['profile', 'Profile'],
        ] as Array<[Screen, string]>
      ).map(([target, label]) => (
        <TouchableOpacity
          key={target}
          onPress={() => setScreen(target)}
          style={[styles.navItem, screen === target && styles.navActive]}
        >
          <Text style={[styles.navText, screen === target && styles.navTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  function AuthShell({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: ReactNode;
  }) {
    return (
      <SafeAreaView style={styles.auth}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.authContent}>
          <Text style={styles.brand}>
            Clinic<Text style={styles.brandAccent}>Care</Text>
          </Text>
          <Text style={styles.authTitle}>{title}</Text>
          <Text style={styles.authSubtitle}>{subtitle}</Text>
          {error ? (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  function Home() {
    const doctor = doctors[0];
    const reminder = upcoming
      ? `Appointment scheduled for ${formatDate(upcoming.startsAt)}`
      : prescriptions[0]
        ? `Latest prescription issued ${new Date(prescriptions[0].issuedAt).toLocaleDateString('en-IN')}`
        : null;
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={loadingHome}
              onRefresh={() => void loadHome()}
              tintColor="#0F766E"
            />
          }
          contentContainerStyle={styles.content}
        >
          <Header
            title={patient ? `Hello, ${patient.firstName}` : 'Your health'}
            subtitle="PATIENT HOME"
          />
          <Text style={styles.intro}>
            Everything you need for your care, in one calm and secure place.
          </Text>
          {error ? (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {loadingHome && !patient ? (
            <ActivityIndicator size="large" color="#0F766E" />
          ) : (
            <>
              <View style={styles.hero}>
                <Text style={styles.heroOverline}>YOUR CLINIC DOCTOR</Text>
                <Text style={styles.heroTitle}>
                  {doctor?.user.displayName ?? 'Doctor information will appear here'}
                </Text>
                {doctor?.clinic?.name ? (
                  <Text style={styles.heroText}>{doctor.clinic.name}</Text>
                ) : null}
                <Text style={styles.heroText}>
                  {doctor
                    ? `${doctor.specialty ?? 'General care'} · ${doctor.clinicHoursStart}–${doctor.clinicHoursEnd}`
                    : 'Choose a clinic during registration to see its care team.'}
                </Text>
                <Button
                  label="Book appointment"
                  onPress={() => setScreen('booking')}
                  disabled={!doctor || !patient}
                />
              </View>
              <Text style={styles.sectionTitle}>Care at a glance</Text>
              <View style={styles.grid}>
                <TouchableOpacity style={styles.tile} onPress={() => setScreen('appointments')}>
                  <Text style={styles.tileTitle}>Upcoming appointment</Text>
                  <Text style={styles.tileText}>
                    {upcoming ? formatDate(upcoming.startsAt) : 'No upcoming appointment'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tile} onPress={() => setScreen('prescriptions')}>
                  <Text style={styles.tileTitle}>My prescriptions</Text>
                  <Text style={styles.tileText}>
                    {prescriptions.length
                      ? `${prescriptions.length} recent record${prescriptions.length > 1 ? 's' : ''}`
                      : 'No prescriptions yet'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tile} onPress={() => setScreen('records')}>
                  <Text style={styles.tileTitle}>Health records</Text>
                  <Text style={styles.tileText}>
                    {records.length
                      ? `${records.length} recent document${records.length > 1 ? 's' : ''}`
                      : 'No records available'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tile} onPress={() => setScreen('medicine')}>
                  <Text style={styles.tileTitle}>Medicine store</Text>
                  <Text style={styles.tileText}>Search your clinic catalogue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tile} onPress={() => setScreen('appointments')}>
                  <Text style={styles.tileTitle}>Previous appointments</Text>
                  <Text style={styles.tileText}>
                    {appointments.filter((item) => new Date(item.startsAt) < new Date()).length
                      ? 'Review completed visits'
                      : 'No previous appointments'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionTitle}>Clinic timings</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {doctor?.user.displayName ?? 'Clinic care team'}
                </Text>
                <Text style={styles.cardText}>
                  {doctor
                    ? `${doctor.clinicHoursStart} to ${doctor.clinicHoursEnd} · ${doctor.consultationDuration} minute consultations`
                    : 'Timings are unavailable.'}
                </Text>
              </View>
              <Text style={styles.sectionTitle}>Health reminders</Text>
              {reminder ? (
                <View style={styles.reminder}>
                  <Text style={styles.reminderText}>{reminder}</Text>
                </View>
              ) : (
                <Empty
                  title="No health reminders"
                  body="Future care reminders will appear after your clinic records one."
                />
              )}
            </>
          )}
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  }

  if (screen === 'splash')
    return (
      <SafeAreaView style={styles.splash}>
        <StatusBar style="dark" />
        <Text style={styles.brand}>
          Clinic<Text style={styles.brandAccent}>Care</Text>
        </Text>
        <ActivityIndicator color="#0F766E" />
      </SafeAreaView>
    );
  if (screen === 'onboarding') {
    const pages = [
      ['Care made clear', 'Keep appointments, prescriptions, and records together.'],
      ['Your time matters', 'Find clinic timings and book an available appointment.'],
      ['Your information stays yours', 'Access only your own authorised health information.'],
    ];
    const page = pages[onboardingStep];
    return (
      <AuthShell title={page[0]} subtitle={page[1]}>
        <View style={styles.onboardingMark}>
          <Text style={styles.onboardingNumber}>0{onboardingStep + 1}</Text>
        </View>
        <View style={styles.dots}>
          {pages.map((_, index) => (
            <View key={index} style={[styles.dot, index === onboardingStep && styles.dotActive]} />
          ))}
        </View>
        <Button
          label={onboardingStep === pages.length - 1 ? 'Get started' : 'Continue'}
          onPress={() =>
            onboardingStep === pages.length - 1
              ? setScreen('login')
              : setOnboardingStep(onboardingStep + 1)
          }
        />
        <Button label="I already have an account" secondary onPress={() => setScreen('login')} />
      </AuthShell>
    );
  }
  if (screen === 'login')
    return (
      <AuthShell title="Welcome back" subtitle="Sign in to view your care information.">
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
          keyboard="email-address"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          secure
          placeholder="Your password"
        />
        <Button
          label={busy ? 'Signing in…' : 'Sign in'}
          onPress={() => void login()}
          disabled={busy}
        />
        <Button
          label="Create patient account"
          secondary
          onPress={() => {
            setError('');
            setScreen('register');
          }}
        />
      </AuthShell>
    );
  if (screen === 'otp')
    return (
      <AuthShell title="Verify your identity" subtitle="Enter the six-digit verification code.">
        <Field
          label="Verification code"
          value={otp}
          onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          keyboard="number-pad"
          placeholder="000000"
        />
        <Button
          label={busy ? 'Verifying…' : 'Verify'}
          onPress={() => void verifyOtp()}
          disabled={busy || otp.length !== 6}
        />
        <Button label="Back to sign in" secondary onPress={() => setScreen('login')} />
      </AuthShell>
    );
  if (screen === 'register')
    return (
      <AuthShell
        title="Create your account"
        subtitle="Enter the clinic identifier supplied by your clinic."
      >
        <Field
          label="Clinic ID"
          value={clinicId}
          onChange={setClinicId}
          placeholder="Clinic UUID"
        />
        <Field label="First name" value={firstName} onChange={setFirstName} />
        <Field label="Last name" value={lastName} onChange={setLastName} />
        <Field
          label="Date of birth"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          placeholder="YYYY-MM-DD"
        />
        <Field label="Mobile number" value={phone} onChange={setPhone} keyboard="phone-pad" />
        <Field label="Email address" value={email} onChange={setEmail} keyboard="email-address" />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          secure
          placeholder="At least 12 characters"
        />
        <Button
          label={busy ? 'Creating account…' : 'Create account'}
          onPress={() => void register()}
          disabled={busy}
        />
        <Button label="Back to sign in" secondary onPress={() => setScreen('login')} />
      </AuthShell>
    );
  if (screen === 'profileSetup')
    return (
      <AuthShell
        title="Complete your profile"
        subtitle="Keep your contact number current for clinic communications."
      >
        <Field label="Mobile number" value={phone} onChange={setPhone} keyboard="phone-pad" />
        <Button
          label={busy ? 'Saving…' : 'Save and continue'}
          onPress={() => void updateProfile()}
          disabled={busy}
        />
      </AuthShell>
    );
  if (screen === 'home') return <Home />;
  if (screen === 'booking')
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Header
            title={rescheduleTarget ? 'Reschedule appointment' : 'Book appointment'}
            subtitle="CLINIC APPOINTMENTS"
            back="home"
          />
          {error ? (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>Choose doctor</Text>
          {doctors.map((doctor) => (
            <TouchableOpacity
              key={doctor.id}
              onPress={() => {
                setSelectedDoctor(doctor);
                setSlots([]);
              }}
              style={[styles.choice, activeDoctor?.id === doctor.id && styles.choiceActive]}
            >
              <Text style={styles.cardTitle}>{doctor.user.displayName}</Text>
              <Text style={styles.cardText}>
                {doctor.specialty ?? 'General care'} · ₹{doctor.appointmentFee}
              </Text>
            </TouchableOpacity>
          ))}
          <Field
            label="Appointment date"
            value={bookingDate}
            onChange={setBookingDate}
            placeholder="YYYY-MM-DD"
          />
          <Button
            label={busy ? 'Loading times…' : 'Find available times'}
            onPress={() => void loadSlots()}
            disabled={busy || !activeDoctor}
          />
          <Text style={styles.sectionTitle}>Available times</Text>
          {slots.length === 0 ? (
            <Empty
              title="No times loaded"
              body="Choose a doctor and date, then load available appointment times."
            />
          ) : (
            <View style={styles.slotWrap}>
              {slots.map((slot) => (
                <TouchableOpacity
                  key={slot.startsAt}
                  onPress={() => setSelectedSlot(slot)}
                  style={[
                    styles.slot,
                    selectedSlot?.startsAt === slot.startsAt && styles.slotActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.slotText,
                      selectedSlot?.startsAt === slot.startsAt && styles.slotTextActive,
                    ]}
                  >
                    {new Date(slot.startsAt).toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Button
            label={busy ? 'Booking…' : 'Confirm appointment'}
            onPress={() => void bookAppointment()}
            disabled={busy || !selectedSlot}
          />
        </ScrollView>
      </SafeAreaView>
    );
  if (screen === 'appointments')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="My appointments" subtitle="CARE SCHEDULE" back="home" />
          {appointments.length === 0 ? (
            <Empty
              title="No appointments"
              body="Your booked and previous appointments will appear here."
            />
          ) : (
            <FlatList
              data={appointments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {item.doctor?.user.displayName ?? 'Clinic appointment'}
                  </Text>
                  <Text style={styles.cardText}>{formatDate(item.startsAt)}</Text>
                  <Text style={styles.status}>{item.status.replace('_', ' ')}</Text>
                  {item.fee !== undefined ? (
                    <Text style={styles.cardText}>Consultation charge: ₹{item.fee}</Text>
                  ) : null}
                  {(() => {
                    const payment = payments.find((row) => row.appointmentId === item.id);
                    if (payment?.receipt)
                      return (
                        <Text style={styles.receipt}>
                          Receipt {payment.receipt.receiptNumber} · ₹{payment.amount}
                        </Text>
                      );
                    if (item.status === 'BOOKED')
                      return (
                        <View style={styles.appointmentActions}>
                          <Button
                            label={busy ? 'Please wait…' : 'Pay securely'}
                            onPress={() => void payForAppointment(item)}
                            disabled={busy || !Number(item.fee ?? 0)}
                          />
                          <Button
                            label="Reschedule"
                            secondary
                            onPress={() => beginReschedule(item)}
                          />
                          <Button
                            label="Cancel booking"
                            secondary
                            disabled={busy}
                            onPress={() =>
                              Alert.alert(
                                'Cancel appointment?',
                                'This will release your booked time.',
                                [
                                  { text: 'Keep appointment', style: 'cancel' },
                                  {
                                    text: 'Cancel booking',
                                    style: 'destructive',
                                    onPress: () => void cancelAppointment(item),
                                  },
                                ],
                              )
                            }
                          />
                        </View>
                      );
                    if (item.status === 'COMPLETED')
                      return (
                        <Button
                          label="Book follow-up"
                          secondary
                          onPress={() => beginFollowUp(item)}
                        />
                      );
                    return null;
                  })()}
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'prescriptions')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="My prescriptions" subtitle="MEDICATION" back="home" />
          {prescriptions.length === 0 ? (
            <Empty
              title="No prescriptions"
              body="Issued prescriptions will appear after your consultation."
            />
          ) : (
            <FlatList
              data={prescriptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.prescriptionNumber}</Text>
                  <Text style={styles.cardText}>
                    {new Date(item.issuedAt).toLocaleDateString('en-IN')}
                  </Text>
                  {item.items.map((medicine) => (
                    <Text key={`${item.id}-${medicine.medicineName}`} style={styles.listLine}>
                      {medicine.medicineName} · {medicine.dosage} · {medicine.frequency}
                    </Text>
                  ))}
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'records')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="Health records" subtitle="CLINICAL DOCUMENTS" back="home" />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upload a report</Text>
            <Text style={styles.muted}>
              After uploading through the clinic’s trusted storage service, add its secure document
              key here.
            </Text>
            <Field
              label="Report title"
              value={reportTitle}
              onChange={setReportTitle}
              placeholder="Blood test report"
            />
            <Field
              label="Secure upload key"
              value={reportStorageKey}
              onChange={setReportStorageKey}
              placeholder="patient-uploads/report.pdf"
            />
            <Button
              label="Add uploaded report"
              disabled={!patient || !reportTitle || !reportStorageKey}
              onPress={() => {
                if (token && patient)
                  void request('/medical-records', token, {
                    method: 'POST',
                    body: JSON.stringify({
                      patientId: patient.id,
                      type: 'LAB_REPORT',
                      title: reportTitle,
                      storageKey: reportStorageKey,
                    }),
                  })
                    .then(() => {
                      setReportTitle('');
                      setReportStorageKey('');
                      return loadHome();
                    })
                    .catch((caught) =>
                      setError(caught instanceof Error ? caught.message : 'Unable to add report'),
                    );
              }}
            />
          </View>
          {records.length === 0 ? (
            <Empty
              title="No records"
              body="Your clinic will make authorised documents available here."
            />
          ) : (
            <FlatList
              data={records}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardText}>
                    {item.type.replace('_', ' ')} ·{' '}
                    {new Date(item.createdAt).toLocaleDateString('en-IN')}
                  </Text>
                  <Text style={styles.muted}>
                    Download is provided by the clinic’s secure document service.
                  </Text>
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'consultations')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="My consultations" subtitle="CARE SUMMARIES" back="profile" />
          {consultations.length === 0 ? (
            <Empty
              title="No consultations"
              body="Consultation summaries will appear after your doctor records them."
            />
          ) : (
            <FlatList
              data={consultations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {new Date(item.startedAt).toLocaleDateString('en-IN')}
                  </Text>
                  <Text style={styles.cardText}>
                    {item.clinicalNotes || item.treatmentPlan || 'Summary is not available yet.'}
                  </Text>
                  <Text style={styles.status}>{item.status}</Text>
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'family')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="Family members" subtitle="FAMILY PROFILES" back="profile" />
          <View style={styles.card}>
            <Field label="Family member name" value={familyName} onChange={setFamilyName} />
            <Field
              label="Relationship"
              value={familyRelationship}
              onChange={setFamilyRelationship}
            />
            <Button
              label="Add family profile"
              disabled={!familyName || !familyRelationship}
              onPress={() => {
                if (token)
                  void request('/patient-sharing/family', token, {
                    method: 'POST',
                    body: JSON.stringify({ name: familyName, relationship: familyRelationship }),
                  }).then(() => {
                    setFamilyName('');
                    setFamilyRelationship('');
                    return loadHome();
                  });
              }}
            />
          </View>
          {family.length === 0 ? (
            <Empty
              title="No family profiles"
              body="Add a family member through your clinic to manage their approved care."
            />
          ) : (
            <FlatList
              data={family}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardText}>
                    {item.relationship}
                    {item.phone ? ` · ${item.phone}` : ''}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'sharing')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="Sharing consent" subtitle="YOUR RECORDS" back="profile" />
          <Text style={styles.muted}>
            Consent changes are recorded and may be revoked at any time.
          </Text>
          <Button
            label="Grant clinic care-sharing consent"
            onPress={() => {
              if (token)
                void request('/patient-sharing/consents', token, {
                  method: 'POST',
                  body: JSON.stringify({ consentType: 'CARE_RECORD_SHARING', version: '1' }),
                }).then(loadHome);
            }}
          />
          {consents.length === 0 ? (
            <Empty
              title="No active sharing consent"
              body="Your records stay private unless you grant consent."
            />
          ) : (
            <FlatList
              data={consents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.consentType}</Text>
                  <Text style={styles.cardText}>
                    Version {item.version} · {item.revokedAt ? 'Revoked' : 'Active'}
                  </Text>
                  {!item.revokedAt ? (
                    <Button
                      label="Revoke consent"
                      secondary
                      onPress={() => {
                        if (token)
                          void request(`/patient-sharing/consents/${item.id}/revoke`, token, {
                            method: 'POST',
                            body: '{}',
                          }).then(loadHome);
                      }}
                    />
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'medicine')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="Medicine store" subtitle="CLINIC CATALOGUE" back="home" />
          <Field
            label="Search medicine"
            value={medicineSearch}
            onChange={(value) => void searchMedicine(value)}
            placeholder="Medicine or generic name"
          />
          {medicines.length === 0 ? (
            <Empty
              title="Search medicines"
              body="Results from your clinic medicine catalogue will appear here."
            />
          ) : (
            <FlatList
              data={medicines}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardText}>
                    {[item.genericName, item.brandName, item.strength]
                      .filter(Boolean)
                      .join(' · ') || 'Clinic medicine catalogue'}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'notifications')
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Header title="Notifications" subtitle="CARE UPDATES" back="home" />
          {notices.length === 0 ? (
            <Empty
              title="All caught up"
              body="Clinic updates and appointment reminders will appear here."
            />
          ) : (
            <FlatList
              data={notices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => void markRead(item.id)}
                  style={[styles.card, !item.readAt && styles.unread]}
                >
                  <Text style={styles.cardTitle}>{item.subject ?? 'ClinicCare update'}</Text>
                  <Text style={styles.cardText}>{item.body}</Text>
                  <Text style={styles.muted}>
                    {new Date(item.createdAt).toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
        <Navigation />
      </SafeAreaView>
    );
  if (screen === 'profile')
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Header title="My profile" subtitle="PATIENT ACCOUNT" back="home" />
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {`${patient?.firstName?.[0] ?? ''}${patient?.lastName?.[0] ?? ''}` || 'P'}
            </Text>
          </View>
          <Text style={styles.profileName}>
            {patient ? `${patient.firstName} ${patient.lastName}` : email}
          </Text>
          <Text style={styles.muted}>{patient?.medicalRecordNumber ?? 'Patient profile'}</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact details</Text>
            <Text style={styles.cardText}>{phone || patient?.phone || 'Add a mobile number'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allergies</Text>
            <Text style={styles.cardText}>{patient?.allergies || 'None recorded'}</Text>
            <Text style={styles.cardTitle}>Current medications</Text>
            <Text style={styles.cardText}>{patient?.currentMedication || 'None recorded'}</Text>
          </View>
          <Button label="My consultations" secondary onPress={() => setScreen('consultations')} />
          <Button label="My documents and reports" secondary onPress={() => setScreen('records')} />
          <Button label="Family members" secondary onPress={() => setScreen('family')} />
          <Button label="Sharing consent" secondary onPress={() => setScreen('sharing')} />
          <Button
            label="Update profile"
            onPress={() => {
              setPhone(patient?.phone ?? phone);
              setScreen('profileSetup');
            }}
          />
          <Button label="Settings" secondary onPress={() => setScreen('settings')} />
          <Button label="Sign out" secondary onPress={() => void logout()} />
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header title="Settings" subtitle="PREFERENCES" back="profile" />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy</Text>
          <Text style={styles.cardText}>
            Your patient account can access only your own authorised information and dependent
            records approved by your clinic.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Text style={styles.cardText}>
            {refreshToken
              ? 'Secure sign-in session active on this device.'
              : 'No refresh session is stored.'}
          </Text>
        </View>
      </ScrollView>
      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FBFC',
    gap: 18,
  },
  auth: { flex: 1, backgroundColor: '#F7FBFC' },
  authContent: { padding: 28, paddingTop: 72, gap: 16 },
  screen: { flex: 1, backgroundColor: '#F7FBFC' },
  content: { padding: 20, paddingBottom: 100, gap: 14, flexGrow: 1 },
  brand: { color: '#123047', fontSize: 29, fontWeight: '800', letterSpacing: -1 },
  brandAccent: { color: '#0F766E' },
  authTitle: { color: '#123047', fontSize: 28, fontWeight: '800', marginTop: 38 },
  authSubtitle: { color: '#64748B', fontSize: 16, lineHeight: 23, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerTitle: { fontSize: 25, color: '#123047', fontWeight: '800' },
  headerLink: { color: '#0F766E', fontWeight: '700' },
  eyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  intro: { color: '#64748B', lineHeight: 20 },
  field: { gap: 6 },
  fieldLabel: { color: '#334155', fontWeight: '700', fontSize: 14 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#123047',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonSecondary: { backgroundColor: '#E6F4F2', borderWidth: 1, borderColor: '#B7DED8' },
  buttonDisabled: { opacity: 0.52 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  buttonTextSecondary: { color: '#0F766E' },
  error: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: '#B42318', lineHeight: 19 },
  hero: { backgroundColor: '#123E53', padding: 20, borderRadius: 18, gap: 9 },
  heroOverline: { color: '#9EDDD3', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroText: { color: '#D7E9ED', lineHeight: 20, marginBottom: 5 },
  sectionTitle: { color: '#123047', fontSize: 18, fontWeight: '800', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4EA',
    padding: 14,
    width: '48%',
    minHeight: 116,
    justifyContent: 'space-between',
  },
  tileTitle: { color: '#123047', fontWeight: '800', fontSize: 14 },
  tileText: { color: '#64748B', fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4EA',
    padding: 15,
    borderRadius: 14,
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: { color: '#123047', fontSize: 16, fontWeight: '800' },
  cardText: { color: '#64748B', lineHeight: 20 },
  reminder: { backgroundColor: '#E6F4F2', borderRadius: 12, padding: 14 },
  reminderText: { color: '#115E59', fontWeight: '700', lineHeight: 20 },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4EA',
    padding: 18,
    alignItems: 'center',
    gap: 7,
  },
  emptyTitle: { color: '#123047', fontWeight: '800' },
  emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 19 },
  nav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#D8E4EA',
    paddingVertical: 11,
    justifyContent: 'space-around',
  },
  navItem: { paddingVertical: 5, paddingHorizontal: 8 },
  navActive: { borderBottomWidth: 2, borderColor: '#0F766E' },
  navText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  navTextActive: { color: '#0F766E' },
  choice: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E4EA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  choiceActive: { borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  slot: {
    borderWidth: 1,
    borderColor: '#B7DED8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  slotActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  slotText: { color: '#0F766E', fontWeight: '700' },
  slotTextActive: { color: '#FFFFFF' },
  status: { color: '#0F766E', textTransform: 'capitalize', fontWeight: '800', fontSize: 12 },
  receipt: { color: '#0F766E', fontWeight: '800', marginTop: 4 },
  appointmentActions: { gap: 8, marginTop: 8 },
  listLine: { color: '#334155', lineHeight: 20 },
  unread: { borderColor: '#0F766E', borderWidth: 1.5 },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  profileAvatar: {
    backgroundColor: '#D6F0EB',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 18,
  },
  profileAvatarText: { color: '#0F766E', fontWeight: '800', fontSize: 28 },
  profileName: { color: '#123047', fontWeight: '800', fontSize: 22, textAlign: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  onboardingMark: {
    height: 230,
    borderRadius: 22,
    backgroundColor: '#D6F0EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  onboardingNumber: { color: '#0F766E', fontSize: 74, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C6D6DD' },
  dotActive: { backgroundColor: '#0F766E', width: 22 },
});
