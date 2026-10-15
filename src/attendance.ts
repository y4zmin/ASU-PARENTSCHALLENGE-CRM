/*
Attendance tab for the parent dashboard.
Lets parents see the sessions their family went to
and how close they are to the 12 hours they need.

Right now this just opens and closes the attendance tab.
Next: the sessions table, hours progress, and a year filter
to see past program years.
*/

import './attendance.css'

//empty box in html where the attendance tab goes; '!' at end to say box is always on page;
const section = document.querySelector<HTMLElement>('#attendance-section')!;

//all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a');

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

//title and description inside attendance tab
section.innerHTML = `
    <h2 class="attendance-title">Attendance History</h2>
    <p class="attendance-intro">
        Track the sessions you and your family have attended
        and your progress toward the required 12 hours of learning.
    </p>
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
