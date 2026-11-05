
import { supabase } from "./supabase";

interface ProgramYear {
    name: string;
}

interface ApplicationParent {
    id: number;
    application_id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    relationship_to_scholar: string | null;
    is_primary: boolean | null;
    preferred_language: string | null;
    ethnicity: string | null;
    education_level: string | null;
    employer: string | null;
}

interface ApplicationScholar {
    id: number;
    application_id: number;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    grade_level: string | null;
    school_type: string | null;
    school_name: string | null;
    ethnicity: string | null;
    applying_for_scholarship: boolean | null;
    applying_for_grant: boolean | null;
}

type ApplicationStatus =
    | "waitlisted"
    | "under_review"
    | "approved"
    | "rejected"
    | "withdrawn";

interface Application {
    id: number;
    application_number: string | null;
    submission_token: string;
    program_year_id: number | null;

    family_name: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    county: string | null;
    primary_phone: string | null;
    primary_email: string;

    application_type: "new_family" | "returning_family";
    status: ApplicationStatus;

    linked_family_id: number | null;
    approved_family_id: number | null;

    submitted_at: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_notes: string | null;

    created_at: string | null;
    updated_at: string | null;

    program_years: ProgramYear | null;
    application_parents: ApplicationParent[];
    application_scholars: ApplicationScholar[];
}


let applications: Application[] = [];


let selectedApplicationId: number | null = null;

function escapeHTML(value: unknown): string {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}




function getStatusLabel(status: ApplicationStatus): string {

    switch (status) {

        case "waitlisted":
        case "under_review":
            return "Pending Review";

        case "approved":
            return "Approved";

        case "rejected":
            return "Rejected";

        default:
            return status;
    }
}


function getStatusClass(status: ApplicationStatus): string {

    switch (status) {

        case "waitlisted":
        case "under_review":
            return "status-pending";

        case "approved":
            return "status-approved";

        case "rejected":
            return "status-rejected";

        default:
            return "";
    }
}

function formatDate(date: string | null): string {

    if (!date) {
        return "N/A";
    }

    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function formatBirthDate(date: string | null): string {

    if (!date) {
        return "N/A";
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (isNaN(parsedDate.getTime())) {
        return "N/A";
    }

    return parsedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}


function displayValue(value: string | null | undefined): string {

    return escapeHTML(value?.trim() || "Not provided");
}


function yesNo(value: boolean | null): string {

    if (value === null) {
        return "Not specified";
    }

    return value ? "Yes" : "No";
}



async function fetchApplications(): Promise<Application[]> {

    console.log("Starting application fetch...");

    const { data, error } = await supabase
        .from("applications")
        .select(`
            *,
            program_years (
                name
            ),
            application_parents (
                *
            ),
            application_scholars (
                *
            )
        `)
        .neq("status", "withdrawn")
        .order("submitted_at", {
            ascending: false,
            nullsFirst: false
        });

    if (error) {

        console.error("SUPABASE FETCH ERROR:");
        console.error("Message:", error.message);
        console.error("Details:", error.details);
        console.error("Hint:", error.hint);
        console.error("Code:", error.code);

        return [];

    }

    console.log("Successfully retrieved applications!");
    console.log("Number of applications:", data?.length);
    console.log("Application data:", data);

    return (data ?? []) as unknown as Application[];
}


function updateStatistics(): void {

    const total = applications.length;

    const pending = applications.filter(app =>
        app.status === "waitlisted" ||
        app.status === "under_review"
    ).length;

    const approved = applications.filter(
        app => app.status === "approved"
    ).length;

    const rejected = applications.filter(
        app => app.status === "rejected"
    ).length;

    document.getElementById("total-count")!.textContent =
        total.toString();

    document.getElementById("pending-count")!.textContent =
        pending.toString();

    document.getElementById("approved-count")!.textContent =
        approved.toString();

    document.getElementById("rejected-count")!.textContent =
        rejected.toString();
}

function displayApplications(): void {

    const tableBody = document.getElementById(
        "applications-table-body"
    );

    const noApplications = document.getElementById(
        "no-applications"
    );

    const searchInput = document.getElementById(
        "application-search"
    ) as HTMLInputElement;

    const statusFilter = document.getElementById(
        "status-filter"
    ) as HTMLSelectElement;

    if (!tableBody || !noApplications) {
        return;
    }

    const searchValue = searchInput.value
        .trim()
        .toLowerCase();

    const selectedStatus = statusFilter.value;

    const filteredApplications = applications.filter(app => {

        const matchesSearch =
            (app.family_name ?? "").toLowerCase().includes(searchValue) ||
            (app.application_number ?? "").toLowerCase().includes(searchValue);

        let matchesStatus = true;

        if (selectedStatus === "pending_review") {

            matchesStatus =
                app.status === "waitlisted" ||
                app.status === "under_review";

        } else if (selectedStatus === "approved") {

            matchesStatus = app.status === "approved";

        } else if (selectedStatus === "rejected") {

            matchesStatus = app.status === "rejected";
        }

        return matchesSearch && matchesStatus;

    });

    tableBody.innerHTML = "";

    if (filteredApplications.length === 0) {

        noApplications.hidden = false;
        return;
    }

    noApplications.hidden = true;

    filteredApplications.forEach(app => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                ${displayValue(app.application_number)}
            </td>

            <td>
                ${displayValue(app.family_name)}
            </td>

            <td>
                ${formatDate(app.submitted_at)}
            </td>

            <td>
                ${displayValue(app.program_years?.name)}
            </td>

            <td>
                <span class="status-badge ${getStatusClass(app.status)}">
                    ${getStatusLabel(app.status)}
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="view-button"
                    data-application-id="${app.id}">
                    View Application
                </button>
            </td>
        `;

        tableBody.appendChild(row);

    });

}


function displayFamilyInformation(app: Application): string {

    return `

        <section class="detail-section">

            <h3>Family Information</h3>

            <div class="detail-grid">

                <div class="detail-field">
                    <span>Family Name</span>
                    <strong>${displayValue(app.family_name)}</strong>
                </div>

                <div class="detail-field">
                    <span>Application Type</span>
                    <strong>
                        ${app.application_type === "new_family"
                            ? "New Family"
                            : "Returning Family"}
                    </strong>
                </div>

                <div class="detail-field">
                    <span>Primary Email</span>
                    <strong>${displayValue(app.primary_email)}</strong>
                </div>

                <div class="detail-field">
                    <span>Primary Phone</span>
                    <strong>${displayValue(app.primary_phone)}</strong>
                </div>

                <div class="detail-field">
                    <span>Address Line 1</span>
                    <strong>${displayValue(app.address_line1)}</strong>
                </div>

                <div class="detail-field">
                    <span>Address Line 2</span>
                    <strong>${displayValue(app.address_line2)}</strong>
                </div>

                <div class="detail-field">
                    <span>City</span>
                    <strong>${displayValue(app.city)}</strong>
                </div>

                <div class="detail-field">
                    <span>State</span>
                    <strong>${displayValue(app.state)}</strong>
                </div>

                <div class="detail-field">
                    <span>ZIP Code</span>
                    <strong>${displayValue(app.zip_code)}</strong>
                </div>

                <div class="detail-field">
                    <span>County</span>
                    <strong>${displayValue(app.county)}</strong>
                </div>

            </div>

        </section>

    `;
}

function displayParentInformation(app: Application): string {

    if (!app.application_parents ||
        app.application_parents.length === 0) {

        return `
            <section class="detail-section">
                <h3>Parent / Guardian Information</h3>
                <p class="empty-detail">
                    No parent/guardian information found.
                </p>
            </section>
        `;
    }

    const parentCards = app.application_parents.map(
        (parent, index) => {

            return `

                <div class="person-card">

                    <h4>
                        Parent / Guardian ${index + 1}
                    </h4>

                    <div class="detail-grid">

                        <div class="detail-field">
                            <span>First Name</span>
                            <strong>${displayValue(parent.first_name)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Last Name</span>
                            <strong>${displayValue(parent.last_name)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Email</span>
                            <strong>${displayValue(parent.email)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Phone</span>
                            <strong>${displayValue(parent.phone)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Relationship to Scholar</span>
                            <strong>${displayValue(parent.relationship_to_scholar)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Preferred Language</span>
                            <strong>${displayValue(parent.preferred_language)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Race / Ethnicity</span>
                            <strong>${displayValue(parent.ethnicity)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Education Level</span>
                            <strong>${displayValue(parent.education_level)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Employer</span>
                            <strong>${displayValue(parent.employer)}</strong>
                        </div>

                    </div>

                    <div class="application-selections">

                        <div>
                            <span>Primary Contact</span>
                            <strong>${yesNo(parent.is_primary)}</strong>
                        </div>

                    </div>

                </div>

            `;

        }
    ).join("");

    return `

        <section class="detail-section">

            <h3>Parent / Guardian Information</h3>

            ${parentCards}

        </section>

    `;
}


function displayScholarInformation(app: Application): string {

    if (!app.application_scholars ||
        app.application_scholars.length === 0) {

        return `
            <section class="detail-section">
                <h3>Scholar Information</h3>
                <p class="empty-detail">
                    No scholar information found.
                </p>
            </section>
        `;
    }

    const scholarCards = app.application_scholars.map(
        (scholar, index) => {

            return `

                <div class="person-card">

                    <h4>Scholar ${index + 1}</h4>

                    <div class="detail-grid">

                        <div class="detail-field">
                            <span>First Name</span>
                            <strong>${displayValue(scholar.first_name)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Last Name</span>
                            <strong>${displayValue(scholar.last_name)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Date of Birth</span>
                            <strong>${formatBirthDate(scholar.date_of_birth)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Grade Level</span>
                            <strong>${displayValue(scholar.grade_level)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>School Type</span>
                            <strong>${displayValue(scholar.school_type)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>School Name</span>
                            <strong>${displayValue(scholar.school_name)}</strong>
                        </div>

                        <div class="detail-field">
                            <span>Race / Ethnicity</span>
                            <strong>${displayValue(scholar.ethnicity)}</strong>
                        </div>

                    </div>

                    <div class="application-selections">

                        <div>
                            <span>Applying for Scholarship</span>
                            <strong>${yesNo(scholar.applying_for_scholarship)}</strong>
                        </div>

                        <div>
                            <span>Applying for Grant</span>
                            <strong>${yesNo(scholar.applying_for_grant)}</strong>
                        </div>

                    </div>

                </div>

            `;

        }
    ).join("");

    return `

        <section class="detail-section">

            <h3>Scholar Information</h3>

            ${scholarCards}

        </section>

    `;
}

//app pop up

function displayApplicationDetails(app: Application): void {

    selectedApplicationId = app.id;

    const dialog = document.getElementById(
        "application-dialog"
    ) as HTMLDialogElement;

    const details = document.getElementById(
        "application-details"
    );

    const applicationNumber = document.getElementById(
        "dialog-application-number"
    );

    const approveButton = document.getElementById(
        "dialog-approve"
    ) as HTMLButtonElement;

    const rejectButton = document.getElementById(
        "dialog-reject"
    ) as HTMLButtonElement;

    if (!dialog || !details || !applicationNumber) {
        return;
    }

    applicationNumber.textContent =
        app.application_number ?? "Application #" + app.id;

    const summary = `

        <section class="application-summary">

            <div>
                <span>Application Status</span>
                <strong>
                    <span class="status-badge ${getStatusClass(app.status)}">
                        ${getStatusLabel(app.status)}
                    </span>
                </strong>
            </div>

            <div>
                <span>Program Year</span>
                <strong>${displayValue(app.program_years?.name)}</strong>
            </div>

            <div>
                <span>Submitted On</span>
                <strong>${formatDate(app.submitted_at)}</strong>
            </div>

        </section>

    `;

    details.innerHTML = `

        ${summary}

        ${displayFamilyInformation(app)}

        ${displayParentInformation(app)}

        ${displayScholarInformation(app)}

    `;

    const isPending =
        app.status === "waitlisted" ||
        app.status === "under_review";

    approveButton.disabled = !isPending;
    rejectButton.disabled = !isPending;

    approveButton.hidden = !isPending;
    rejectButton.hidden = !isPending;

    if (!dialog.open) {
        dialog.showModal();
    }

}


async function updateApplicationStatus(
    newStatus: "approved" | "rejected"
): Promise<void> {

    if (selectedApplicationId === null) {
        return;
    }

    const application = applications.find(
        app => app.id === selectedApplicationId
    );

    if (!application) {
        return;
    }
    if (
        application.status !== "waitlisted" &&
        application.status !== "under_review"
    ) {
        alert("This application has already been reviewed.");
        return;
    }

    const decision = newStatus === "approved"
        ? "approve"
        : "reject";

    const confirmed = confirm(
        `Are you sure you want to ${decision} this application?`
    );

    if (!confirmed) {
        return;
    }
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error("Unable to identify reviewer:", userError);
        alert("Unable to identify the logged-in user.");
        return;
    }

    const { data, error } = await supabase
        .from("applications")
        .update({

            status: newStatus,

            reviewed_at: new Date().toISOString(),

            reviewed_by: user.id

        })
        .eq("id", selectedApplicationId)
        .in("status", ["waitlisted", "under_review"])
        .select("id")
        .maybeSingle();

    if (error) {

        console.error("Error updating application:", error);

        alert("Unable to update the application. Please try again.");

        return;
    }

    if (!data) {

        alert(
            "The application was not updated. It may have already been reviewed or you may not have permission."
        );

        await loadApplications();

        return;
    }

    alert(
        `Application successfully ${newStatus}.`
    );

    const dialog = document.getElementById(
        "application-dialog"
    ) as HTMLDialogElement;

    dialog.close();

    selectedApplicationId = null;

    await loadApplications();

}

async function loadApplications(): Promise<void> {

    const tableBody = document.getElementById(
        "applications-table-body"
    );

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    Loading applications...
                </td>
            </tr>
        `;
    }

    applications = await fetchApplications();

    updateStatistics();

    displayApplications();

}

document.getElementById("application-search")
    ?.addEventListener("input", () => {

        displayApplications();

    });

document.getElementById("status-filter")
    ?.addEventListener("change", () => {

        displayApplications();

    });


document.getElementById("applications-table-body")
    ?.addEventListener("click", (event) => {

        const target = event.target as HTMLElement;

        const button = target.closest(
            ".view-button"
        ) as HTMLButtonElement | null;

        if (!button) {
            return;
        }

        const applicationId = Number(
            button.dataset.applicationId
        );

        const application = applications.find(
            app => app.id === applicationId
        );

        if (!application) {
            return;
        }

        displayApplicationDetails(application);

    });

document.getElementById("dialog-approve")
    ?.addEventListener("click", async () => {

        await updateApplicationStatus("approved");

    });

document.getElementById("dialog-reject")
    ?.addEventListener("click", async () => {

        await updateApplicationStatus("rejected");

    });

document.getElementById("close-dialog")
    ?.addEventListener("click", () => {

        const dialog = document.getElementById(
            "application-dialog"
        ) as HTMLDialogElement;

        dialog.close();

        selectedApplicationId = null;

    });

document.getElementById("dialog-close")
    ?.addEventListener("click", () => {

        const dialog = document.getElementById(
            "application-dialog"
        ) as HTMLDialogElement;

        dialog.close();

        selectedApplicationId = null;

    });

document.getElementById("application-dialog")
    ?.addEventListener("click", (event) => {

        const dialog = event.currentTarget as HTMLDialogElement;

        if (event.target === dialog) {

            dialog.close();

            selectedApplicationId = null;

        }

    });

document.getElementById("export-button")
    ?.addEventListener("click", () => {

        exportApplications();

    });


function exportApplications(): void {

    const headers = [
        "Application Number",
        "Family Name",
        "Primary Email",
        "Primary Phone",
        "Program Year",
        "Application Type",
        "Submitted On",
        "Status"
    ];

    const rows = applications.map(app => [

        app.application_number ?? "",
        app.family_name,
        app.primary_email,
        app.primary_phone ?? "",
        app.program_years?.name ?? "",
        app.application_type,
        app.submitted_at ?? "",
        getStatusLabel(app.status)

    ]);

    function escapeCSV(value: string): string {

        return `"${String(value).replace(/"/g, '""')}"`;

    }

    const csvContent = [

        headers.map(escapeCSV).join(","),

        ...rows.map(row =>
            row.map(value => escapeCSV(String(value))).join(",")
        )

    ].join("\n");

    const blob = new Blob(
        [csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "applications.csv";

    link.click();

    URL.revokeObjectURL(url);

}

document.addEventListener("DOMContentLoaded", async () => {

    await loadApplications();

});


