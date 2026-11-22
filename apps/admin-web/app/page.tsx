'use client';

import { useEffect, useState } from 'react';
import {
  AppHeader,
  AppointmentCard,
  ChartCard,
  Icon,
  PatientCard,
  SearchBar,
  SecondaryButton,
  StatCard,
  type IconName,
} from '@cliniccare/ui-components';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Appointments', icon: 'calendar' },
  { label: 'Patients', icon: 'users' },
  { label: 'Finance', icon: 'wallet' },
  { label: 'Medical records', icon: 'file' },
];

const appointments = [
  { name: 'Olivia Rhye', initials: 'OR', specialty: 'General consultation', time: '09:30 AM', status: 'Confirmed' as const },
  { name: 'Phoenix Baker', initials: 'PB', specialty: 'Follow-up · Cardiology', time: '10:15 AM', status: 'Waiting' as const },
  { name: 'Lana Steiner', initials: 'LS', specialty: 'Dental checkup', time: '11:00 AM', status: 'Confirmed' as const },
  { name: 'Demi Wilkinson', initials: 'DW', specialty: 'Annual physical', time: '11:45 AM', status: 'Completed' as const },
];

const patients = [
  { name: 'Olivia Rhye', initials: 'OR', detail: 'Patient · CC-20481', lastVisit: 'Today', tone: 'blue' as const },
  { name: 'Phoenix Baker', initials: 'PB', detail: 'Patient · CC-20479', lastVisit: 'Today', tone: 'teal' as const },
  { name: 'Lana Steiner', initials: 'LS', detail: 'Patient · CC-20475', lastVisit: 'Yesterday', tone: 'violet' as const },
];

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'Checking' | 'Connected' | 'Unavailable'>('Checking');

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/health`)
      .then((response) => {
        if (active) setApiStatus(response.ok ? 'Connected' : 'Unavailable');
      })
      .catch(() => {
        if (active) setApiStatus('Unavailable');
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="cc-app-shell">
      <aside className="cc-sidebar">
        <a className="cc-brand" href="#overview" aria-label="ClinicCare home">
          <span className="cc-brand-mark"><Icon name="heart" /></span>
          <span>Clinic<span>Care</span></span>
        </a>
        <div className="cc-clinic-switcher">
          <span className="cc-clinic-avatar">N</span>
          <span><strong>Northstar Clinic</strong><small>Medical practice</small></span>
          <Icon name="chevronDown" />
        </div>
        <p className="cc-nav-caption">WORKSPACE</p>
        <nav className="cc-sidebar-nav" aria-label="Main navigation">
          {navigation.map((item, index) => (
            <a className={index === 0 ? 'is-active' : ''} href={index === 0 ? '#overview' : `#${item.label.toLowerCase().replaceAll(' ', '-')}`} key={item.label}>
              <Icon name={item.icon} /><span>{item.label}</span>{item.label === 'Appointments' && <span className="cc-nav-count">8</span>}
            </a>
          ))}
        </nav>
        <div className="cc-sidebar-bottom">
          <a href="#settings"><Icon name="settings" /><span>Settings</span></a>
          <div className="cc-profile">
            <span className="cc-avatar avatar-profile">MC</span>
            <span><strong>Dr. Maya Chen</strong><small>Clinic administrator</small></span>
            <Icon name="more" />
          </div>
        </div>
      </aside>

      <main className="cc-main" id="overview">
        <div className="cc-mobile-brand"><a className="cc-brand" href="#overview"><span className="cc-brand-mark"><Icon name="heart" /></span><span>Clinic<span>Care</span></span></a><button type="button" className="cc-icon-button" aria-label="Open menu"><Icon name="more" /></button></div>
        <div className="cc-topbar">
          <SearchBar />
          <div className="cc-topbar-actions">
            <span className="cc-api-health"><span className={`cc-health-dot ${apiStatus === 'Unavailable' ? 'is-offline' : ''}`} />API {apiStatus.toLowerCase()}</span>
            <button type="button" className="cc-icon-button cc-notification" aria-label="Notifications"><Icon name="activity" /><i /></button>
            <span className="cc-avatar avatar-profile">MC</span>
          </div>
        </div>

        <div className="cc-content">
          <AppHeader title="Good morning, Maya" subtitle="Here’s what’s happening at your clinic today.">
            <SecondaryButton icon="calendar">Today, Nov 22 <Icon name="chevronDown" /></SecondaryButton>
            <a className="cc-button cc-button-primary" href="#appointments"><Icon name="plus" />New appointment</a>
          </AppHeader>

          <section className="cc-stats-grid" aria-label="Clinic statistics">
            <StatCard title="Total patients" value="2,840" delta="12.8%" icon="users" tone="blue" />
            <StatCard title="Appointments today" value="24" delta="8.2%" icon="calendar" tone="teal" />
            <StatCard title="Avg. wait time" value="12 min" delta="2.4%" icon="clock" tone="violet" />
            <StatCard title="Monthly revenue" value="$48,290" delta="14.6%" icon="wallet" tone="amber" />
          </section>

          <section className="cc-overview-grid">
            <ChartCard title="Patient visits" description="Appointment activity over the last 7 days" action={<button type="button" className="cc-select-button">This week <Icon name="chevronDown" /></button>}>
              <div className="cc-chart-legend"><span><i className="legend-blue" />This week</span><span><i className="legend-teal" />Last week</span></div>
              <div className="cc-chart-wrap" role="img" aria-label="Patient visits chart, showing an upward trend from Monday to Sunday">
                <div className="cc-chart-y-labels"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div>
                <svg className="cc-chart" viewBox="0 0 640 190" preserveAspectRatio="none" aria-hidden="true">
                  <defs><linearGradient id="visitFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3978ee" stopOpacity=".17" /><stop offset="100%" stopColor="#3978ee" stopOpacity="0" /></linearGradient></defs>
                  <path className="cc-chart-gridline" d="M0 16H640M0 55H640M0 94H640M0 133H640M0 172H640" />
                  <path className="cc-chart-line-muted" d="M0 130 C35 122 44 138 80 119 S125 116 160 126 S211 108 240 115 S291 97 320 107 S370 96 400 103 S450 80 480 92 S530 76 560 88 S610 65 640 72" />
                  <path fill="url(#visitFill)" d="M0 145 C34 131 48 137 80 119 S126 109 160 116 S207 91 240 100 S285 71 320 83 S366 59 400 71 S448 43 480 55 S526 28 560 42 S610 23 640 31 L640 172H0Z" />
                  <path className="cc-chart-line" d="M0 145 C34 131 48 137 80 119 S126 109 160 116 S207 91 240 100 S285 71 320 83 S366 59 400 71 S448 43 480 55 S526 28 560 42 S610 23 640 31" />
                  <circle className="cc-chart-point" cx="560" cy="42" r="4" />
                </svg>
                <div className="cc-chart-x-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
              </div>
            </ChartCard>

            <section className="cc-panel cc-appointments-panel" id="appointments">
              <div className="cc-panel-heading"><div><h2>Today’s appointments</h2><p>Sunday, November 22 <span className="cc-today-count">8 scheduled</span></p></div><button type="button" className="cc-icon-button" aria-label="More appointment options"><Icon name="more" /></button></div>
              <div className="cc-appointment-list">{appointments.map((appointment) => <AppointmentCard key={appointment.name} {...appointment} />)}</div>
              <a className="cc-panel-link" href="#appointments">View all appointments <Icon name="arrowUpRight" /></a>
            </section>
          </section>

          <section className="cc-lower-grid">
            <section className="cc-panel cc-patients-panel" id="patients">
              <div className="cc-panel-heading"><div><h2>Recent patients</h2><p>Latest patient activity</p></div><SecondaryButton>View all</SecondaryButton></div>
              <div className="cc-patient-list">{patients.map((patient) => <PatientCard key={patient.name} {...patient} />)}</div>
            </section>
            <section className="cc-panel cc-insight-panel">
              <div className="cc-insight-icon"><Icon name="activity" /></div>
              <div><p className="cc-eyebrow">WEEKLY INSIGHT</p><h2>Great work this week</h2><p>Your team saw <strong>18% more patients</strong> than last week. Average wait time is down by 4 minutes.</p><a href="#reports">View clinic report <Icon name="arrowUpRight" /></a></div>
            </section>
          </section>
          <footer className="cc-footer"><span>© 2026 ClinicCare</span><span>Secure, connected care <Icon name="check" /></span></footer>
        </div>
      </main>
      <nav className="cc-mobile-nav" aria-label="Mobile navigation">{navigation.slice(0, 4).map((item, index) => <a key={item.label} className={index === 0 ? 'is-active' : ''} href={index === 0 ? '#overview' : `#${item.label.toLowerCase()}`}><Icon name={item.icon} /><span>{item.label}</span></a>)}</nav>
    </div>
  );
}
