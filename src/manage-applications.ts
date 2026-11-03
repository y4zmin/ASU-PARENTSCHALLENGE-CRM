
type ApplicationStatus =
    | "pending_review"
    | "under_review"
    | "approved";

interface Application {
    id: number;
    applicationNumber: string;
    familyName: string;
    submittedOn: string;
    programYear: string;
    status: ApplicationStatus;
    primaryEmail: string;
    primaryPhone: string;
}

//test data
let applications: Application[] = [

    {
        id: 1,
        applicationNumber: "PC-2026-1187",
        familyName: "Rodriguez",
        submittedOn: "Oct 28, 2026",
        programYear: "2026–2027",
        status: "pending_review",
        primaryEmail: "rodriguez@email.com",
        primaryPhone: "(303) 555-1234"
    },

    {
        id: 2,
        applicationNumber: "PC-2026-1186",
        familyName: "Johnson",
        submittedOn: "Oct 28, 2026",
        programYear: "2026–2027",
        status: "pending_review",
        primaryEmail: "johnson@email.com",
        primaryPhone: "(303) 555-2345"
    },

    {
        id: 3,
        applicationNumber: "PC-2026-1185",
        familyName: "Williams",
        submittedOn: "Oct 27, 2026",
        programYear: "2026–2027",
        status: "under_review",
        primaryEmail: "williams@email.com",
        primaryPhone: "(303) 555-3456"
    },

    {
        id: 4,
        applicationNumber: "PC-2026-1184",
        familyName: "Lopez",
        submittedOn: "Oct 27, 2026",
        programYear: "2026–2027",
        status: "pending_review",
        primaryEmail: "lopez@email.com",
        primaryPhone: "(303) 555-4567"
    },

    {
        id: 5,
        applicationNumber: "PC-2026-1183",
        familyName: "Garcia",
        submittedOn: "Oct 26, 2026",
        programYear: "2026–2027",
        status: "approved",
        primaryEmail: "garcia@email.com",
        primaryPhone: "(303) 555-5678"
    }
];

const tableBody = document.getElementById(
    "applications-table-body"
) as HTMLTableSectionElement;

const searchInput = document.getElementById(
    "application-search"
) as HTMLInputElement;

const statusFilter = document.getElementById(
    "status-filter"
) as HTMLSelectElement;

const noApplications = document.getElementById(
    "no-applications"
) as HTMLParagraphElement;

const applicationDialog = document.getElementById(
    "application-dialog"
) as HTMLDialogElement;

const applicationDetails = document.getElementById(
    "application-details"
) as HTMLDivElement;

const dialogApprove = document.getElementById(
    "dialog-approve"
) as HTMLButtonElement;


let selectedApplicationId: number | null = null;

function escapeHTML(value: string): string {
    return value.replace(/[&<>"']/g, character => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


function getStatusText(status: ApplicationStatus): string {

    switch (status) {

        case "pending_review":
            return "Pending Review";

        case "under_review":
            return "Under Review";

        case "approved":
            return "Approved";
    }
}

function getStatusClass(status: ApplicationStatus): string {

    switch (status) {

        case "pending_review":
            return "status-pending";

        case "under_review":
            return "status-review";

        case "approved":
            return "status-approved";
    }
}

function updateStatistics(): void {

    const pending = applications.filter(
        app => app.status === "pending_review"
    ).length;

    const underReview = applications.filter(
        app => app.status === "under_review"
    ).length;

    const approved = applications.filter(
        app => app.status === "approved"
    ).length;

    document.getElementById("pending-count")!.textContent =
        pending.toString();

    document.getElementById("review-count")!.textContent =
        underReview.toString();

    document.getElementById("approved-count")!.textContent =
        approved.toString();

    document.getElementById("total-count")!.textContent =
        applications.length.toString();
}
function displayApplications(): void {

    // Get search and filter values
    const searchValue = searchInput.value.toLowerCase().trim();

    const selectedStatus = statusFilter.value;

    // Filter applications
    const filteredApplications = applications.filter(app => {

        const matchesSearch =
            app.familyName.toLowerCase().includes(searchValue) ||
            app.applicationNumber.toLowerCase().includes(searchValue);

        const matchesStatus =
            selectedStatus === "all" ||
            app.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });


  
    tableBody.innerHTML = "";

    noApplications.hidden = filteredApplications.length > 0;


    filteredApplications.forEach(app => {

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>${escapeHTML(app.applicationNumber)}</td>

            <td>${escapeHTML(app.familyName)}</td>

            <td>${escapeHTML(app.submittedOn)}</td>

            <td>${escapeHTML(app.programYear)}</td>

            <td>
                <span class="status-badge ${getStatusClass(app.status)}">
                    ${getStatusText(app.status)}
                </span>
            </td>

            <td>
                <div class="action-buttons">

                    <button
                        class="view-button"
                        data-action="view"
                        data-id="${app.id}">
                        View
                    </button>

                    ${
                        app.status !== "approved"
                        ? `
                            <button
                                class="approve-button"
                                data-action="approve"
                                data-id="${app.id}">
                                Approve
                            </button>
                        `
                        : ""
                    }

                </div>
            </td>

        `;

        tableBody.appendChild(row);

    });

}


function viewApplication(id: number): void {

    const app = applications.find(
        application => application.id === id
    );

    if (!app) return;

    selectedApplicationId = id;

    applicationDetails.innerHTML = `

        <div class="application-detail">
            <strong>Application Number</strong>
            ${escapeHTML(app.applicationNumber)}
        </div>

        <div class="application-detail">
            <strong>Family Name</strong>
            ${escapeHTML(app.familyName)}
        </div>

        <div class="application-detail">
            <strong>Primary Email</strong>
            ${escapeHTML(app.primaryEmail)}
        </div>

        <div class="application-detail">
            <strong>Primary Phone</strong>
            ${escapeHTML(app.primaryPhone)}
        </div>

        <div class="application-detail">
            <strong>Submitted On</strong>
            ${escapeHTML(app.submittedOn)}
        </div>

        <div class="application-detail">
            <strong>Program Year</strong>
            ${escapeHTML(app.programYear)}
        </div>

        <div class="application-detail">
            <strong>Application Status</strong>
            ${getStatusText(app.status)}
        </div>

    `;
    dialogApprove.hidden = app.status === "approved";

    applicationDialog.showModal();

}

function approveApplication(id: number): void {

    const app = applications.find(
        application => application.id === id
    );

    if (!app || app.status === "approved") return;

    const confirmed = window.confirm(
        `Are you sure you want to approve application ${app.applicationNumber}?`
    );

    if (!confirmed) return;

    app.status = "approved";

  
    updateStatistics();
    displayApplications();

   
    if (applicationDialog.open) {
        applicationDialog.close();
    }

    selectedApplicationId = null;

    window.alert("Application successfully approved.");

}


tableBody.addEventListener("click", (event: MouseEvent) => {

    const target = event.target;

    if (!(target instanceof Element)) return;

    const button = target.closest("button[data-action]");

    if (!(button instanceof HTMLButtonElement)) return;

    const id = Number(button.dataset.id);

    const action = button.dataset.action;

    if (action === "view") {

        viewApplication(id);

    }

    else if (action === "approve") {

        approveApplication(id);

    }

});


dialogApprove.addEventListener("click", () => {

    if (selectedApplicationId !== null) {
        approveApplication(selectedApplicationId);
    }

});


document.getElementById("close-dialog")!.addEventListener(
    "click",
    () => applicationDialog.close()
);


document.getElementById("dialog-close")!.addEventListener(
    "click",
    () => applicationDialog.close()
);

searchInput.addEventListener("input", () => {
    displayApplications();
});


statusFilter.addEventListener("change", () => {
    displayApplications();
});


document.getElementById("export-button")!.addEventListener(
    "click",
    () => {

        const headers = [
            "Application Number",
            "Family Name",
            "Submitted On",
            "Program Year",
            "Status"
        ];

        const rows = applications.map(app => [
            app.applicationNumber,
            app.familyName,
            app.submittedOn,
            app.programYear,
            getStatusText(app.status)
        ]);

        const csvContent = [
            headers,
            ...rows
        ].map(row =>
            row.map(value =>
                `"${String(value).replace(/"/g, '""')}"`
            ).join(",")
        ).join("\n");

        const blob = new Blob(
            [csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = "pending-applications.csv";

        link.click();

        URL.revokeObjectURL(url);

    }
);

updateStatistics();
displayApplications();