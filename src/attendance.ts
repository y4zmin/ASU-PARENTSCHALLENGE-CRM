/*
Attendance tab for the parent dashboard.
Lets parents see the sessions their family went to
and how close they are to the 12 hours they need.
*/

import './attendance.css'

//empty box in html where the attendance tab goes; '!' at end to say box is always on page;
const section = document.querySelector<HTMLElement>('#attendance-section')!;

//all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a');

//attended session kept record
interface AttendanceRecord {
    programYear: string;
    sessionTitle: string;
    sessionType: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    attendees: string[];
}

//sample data for now, will come from supabase later
//ordered form newest to oldest, so table shows the latest sessions first
const attendanceRecords: AttendanceRecord[] = [
    {
        programYear: '2026-2027',
        sessionTitle: 'Session 1',
        sessionType: 'Lunch & Learn',
        sessionDate: '2026-10-06',
        startTime: '12:00',
        endTime: '13:00',
        attendees: ['Vanessa Aniston (Parent)', 'Jake Aniston (Scholar)'],
    },
    {
        programYear: '2026-2027',
        sessionTitle: 'Session 2',
        sessionType: 'In-person',
        sessionDate: '2026-09-22',
        startTime: '18:00',
        endTime: '20:00',
        attendees: ['Vanessa Aniston (Parent)', 'Maria Lopez (Guest)'],
    },
    {
        programYear: '2026-2027',
        sessionTitle: 'Session 3',
        sessionType: 'Mandatory',
        sessionDate: '2026-08-25',
        startTime: '17:00',
        endTime: '19:00',
        attendees: ['Vanessa Aniston (Parent)', 'Daniel Aniston (Parent)', 'Jake Aniston (Scholar)', 'Alice Aniston (Scholar)'],
    },
    {
        programYear: '2025-2026',
        sessionTitle: 'Session 4',
        sessionType: 'In-person',
        sessionDate: '2026-04-14',
        startTime: '18:00',
        endTime: '21:00',
        attendees: ['Vanessa Aniston (Parent)', 'Jake Aniston (Scholar)'],
    },
    {
        programYear: '2025-2026',
        sessionTitle: 'Session 5',
        sessionType: 'Community event',
        sessionDate: '2026-03-21',
        startTime: '11:00',
        endTime: '14:00',
        attendees: ['Vanessa Aniston (Parent)', 'Daniel Aniston (Parent)', 'Jake Aniston (Scholar)', 'Alice Aniston (Scholar)'],
    },
    {
        programYear: '2025-2026',
        sessionTitle: 'Session 6',
        sessionType: 'In-person',
        sessionDate: '2025-11-18',
        startTime: '18:00',
        endTime: '21:00',
        attendees: ['Vanessa Aniston (Parent)'],
    },
    {
        programYear: '2025-2026',
        sessionTitle: 'Session 7',
        sessionType: 'Mandatory',
        sessionDate: '2025-08-26',
        startTime: '17:00',
        endTime: '20:00',
        attendees: ['Vanessa Aniston (Parent)', 'Daniel Aniston (Parent)'],
    },
];

//helper function for formatting date better
function formatDate(date: string): string {
    const dateParts = date.split('-');
    const dateObject = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
    return dateObject.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
}

//how long a session was in hours
function getHours(record: AttendanceRecord): number {
    const start = record.startTime.split(':');
    const end = record.endTime.split(':');

    const startMinutes = Number(start[0]) * 60 + Number(start[1]);
    const endMinutes = Number(end[0]) * 60 + Number(end[1]);
    
    return (endMinutes - startMinutes) / 60;
}

//builds one table row for each session
function buildTableRows(records: AttendanceRecord[]): string {
    let rows = '';

    for (const record of records) {
        rows += `
            <tr>
                <td>${formatDate(record.sessionDate)}</td>
                <td>${record.sessionTitle}</td>
                <td>${record.sessionType}</td>
                <td>${record.attendees.join(', ')}</td>
                <td class="hours-cell">${getHours(record)}</td>
            </tr>
        `;
    }

    return rows;
}

//open closing the attendance tab
function showAttendance(show: boolean): void {

    //show tab if true; hide if false;
    section.hidden = !show;

    //keep attendance tab underlined while the tab is open
    for(const link of navLinks) {
        if(show && link.dataset.tab === 'attendance') {
            link.classList.add('active');
        }
        else {
            link.classList.remove('active');
        }
    }
    
}

//title, description, and sessions table inside attendance tab
section.innerHTML = `
    <h2 class="attendance-title">Attendance History</h2>
    <p class="attendance-intro">
        Track the sessions you and your family have attended
        and your progress toward the required 12 hours of learning.
    </p>

    <div class="table-wrapper">
        <table class="attendance-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Session</th>
                    <th>Type</th>
                    <th>Who Attended</th>
                    <th>Hours</th>
                </tr>
            </thead>
            <tbody>
                ${buildTableRows(attendanceRecords)}
            </tbody>
        </table>
    </div>
`;

//runs when nav link clicked
//whatever link is clicked is set as event.currentTarget
function handleNavClick(event: Event): void {
    const clickedLink = event.currentTarget as HTMLAnchorElement;

    if (clickedLink.dataset.tab === 'attendance') {
        showAttendance(true);
    }
    else {
        showAttendance(false);
    }
}

//run handleNavclick if any nav link is clicked
for(const link of navLinks) {
    link.addEventListener('click', handleNavClick);
}

//open tab if url ends with #attendance
if(window.location.hash === '#attendance') {
    showAttendance(true);
}
else {
    showAttendance(false);
}
