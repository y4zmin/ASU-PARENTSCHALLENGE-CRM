import { supabase } from './supabase';

interface ApplicationResult {
    application_id: number;
    application_number: string;
    submission_token: string;
}

interface ParentData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    relationship_to_scholar: string;
    is_primary: boolean;
    preferred_language: string;
    ethnicity: string;
    education_level: string;
    employer: string;
}


interface ScholarData {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    grade_level: string;
    school_type: string;
    school_name: string;
    ethnicity: string;
    applying_for_scholarship: boolean;
    applying_for_grant: boolean;
}


const form = document.querySelector<HTMLFormElement>(
    '#application-form'
);

const message = document.querySelector<HTMLDivElement>(
    '#form-message'
);

const submitButton = document.querySelector<HTMLButtonElement>(
    '#submit-button'
);

const parentsList = document.querySelector<HTMLDivElement>(
    '#parents-list'
);

const scholarsList = document.querySelector<HTMLDivElement>(
    '#scholars-list'
);

//Stop if the HTML elements are missing.
if (!form || !message || !submitButton ||
    !parentsList || !scholarsList) {
    throw new Error('Application form elements could not be found.');
}

function getField(
    card: HTMLElement,
    fieldName: string
): string {
    const field = card.querySelector<
        HTMLInputElement | HTMLSelectElement
    >(`[data-field="${fieldName}"]`);

    return field?.value.trim() ?? '';
}

function getChecked(
    card: HTMLElement,
    fieldName: string
): boolean {
    const field = card.querySelector<HTMLInputElement>(
        `input[data-field="${fieldName}"]`
    );

    return field?.checked ?? false;
}

//Display a message to the user.
function showMessage(
    text: string,
    isError: boolean = false
): void {
    message!.textContent = text;
    message!.setAttribute(
        'role',
        isError ? 'alert' : 'status'
    );

    message!.classList.toggle('error', isError);
    message!.classList.toggle('success', !isError);
}

//Get the form's family-level fields by their name attributes.
function getFamilyField(name: string): string {
    const field = form!.elements.namedItem(name);

    if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
    ) {
        return field.value.trim();
    }

    return '';
}

// Collect parent/guardian records.
function collectParents(): ParentData[] {
    const cards = Array.from(
        parentsList!.querySelectorAll<HTMLElement>('.repeat-card')
    );

    return cards
        .filter(card => {
            // Ignore a completely empty optional parent card.
            return (
                getField(card, 'first_name') !== '' ||
                getField(card, 'last_name') !== ''
            );
        })
        .map((card, index) => ({
            first_name: getField(card, 'first_name'),
            last_name: getField(card, 'last_name'),
            email: getField(card, 'email'),
            phone: getField(card, 'phone'),
            relationship_to_scholar: getField(
                card,
                'relationship_to_scholar'
            ),
            // The first parent is the default primary contact.
            is_primary: index === 0
                ? true
                : getChecked(card, 'is_primary'),
            preferred_language: getField(
                card,
                'preferred_language'
            ),
            ethnicity: getField(card, 'ethnicity'),
            education_level: getField(card, 'education_level'),
            employer: getField(card, 'employer')
        }));
}


function collectScholars(): ScholarData[] {
    const cards = Array.from(
        scholarsList!.querySelectorAll<HTMLElement>('.repeat-card')
    );

    return cards
        .filter(card => {
            //ignore optional 2nd scholar
            return (
                getField(card, 'first_name') !== '' ||
                getField(card, 'last_name') !== ''
            );
        })
        .map(card => ({
            first_name: getField(card, 'first_name'),
            last_name: getField(card, 'last_name'),
            date_of_birth: getField(card, 'date_of_birth'),
            grade_level: getField(card, 'grade_level'),
            school_type: getField(card, 'school_type'),
            school_name: getField(card, 'school_name'),
            ethnicity: getField(card, 'ethnicity'),
            applying_for_scholarship: getChecked(
                card,
                'applying_for_scholarship'
            ),
            applying_for_grant: getChecked(
                card,
                'applying_for_grant'
            )
        }));
}

//form submission
form.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();

    showMessage('');

  //const programYear = getFamilyField('program_year_id');
    const familyName = getFamilyField('family_name');
    const primaryEmail = getFamilyField('primary_email');
    const state = getFamilyField('state');

  /*  if (
        !programYear ||
        !Number.isInteger(Number(programYear)) ||
        Number(programYear) < 2027
    ) {
        showMessage(
            'Please enter a valid program year.',
            true
        );
        return;
    }*/

    if (!familyName) {
        showMessage('Family name is required.', true);
        return;
    }

    if (!primaryEmail) {
        showMessage('Primary email is required.', true);
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) {
        showMessage('Please enter a valid primary email.', true);
        return;
    }

    if (!state) {
        showMessage('Please select a state.', true);
        return;
    }

    const parents = collectParents();
    const scholars = collectScholars();

    if (parents.length === 0) {
        showMessage(
            'At least one parent or guardian is required.',
            true
        );
        return;
    }

    if (parents.some(
        parent => !parent.first_name || !parent.last_name
    )) {
        showMessage(
            'Enter both first and last names for each parent or guardian you started.',
            true
        );
        return;
    }

    if (scholars.length === 0) {
        showMessage('At least one scholar is required.', true);
        return;
    }

    if (scholars.some(
        scholar => !scholar.first_name || !scholar.last_name
    )) {
        showMessage(
            'Enter both first and last names for each scholar you started.',
            true
        );
        return;
    }

    if (scholars.some(
        scholar =>
            !scholar.date_of_birth ||
            !scholar.grade_level ||
            !scholar.school_type
    )) {
        showMessage(
            'Complete the date of birth, grade level, and school type for each scholar.',
            true
        );
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
        //Call PostgreSQL function through supabase
        const { data, error } = await supabase.rpc(
            'submit_application',
            {
                p_program_year_id: null,
                p_family_name: familyName,
                p_address_line1: getFamilyField('address_line1'),
                p_address_line2: getFamilyField('address_line2'),
                p_city: getFamilyField('city'),
                p_state: state,
                p_zip_code: getFamilyField('zip_code'),
                p_county: getFamilyField('county'),
                p_primary_phone: getFamilyField('primary_phone'),
                p_primary_email: primaryEmail.toLowerCase(),
                p_parents: parents,
                p_scholars: scholars
            }
        );

        if (error) {
            throw error;
        }

    
        const result = Array.isArray(data)
            ? data[0] as ApplicationResult | undefined
            : data as ApplicationResult | null;

        if (!result || !result.application_number) {
            throw new Error(
                'The application was submitted, but its confirmation could not be read. Please contact Parents Challenge before trying again.'
            );
        }

        showMessage(
            `Application submitted successfully! Your application number is ${result.application_number}.`
        );

        form.reset();

    } catch (error: unknown) {
        console.error('Application submission failed:', error);

        showMessage(
            'We could not confirm your submission. Please contact Parents Challenge before trying again.',
            true
        );
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Application';
    }
});


//dropdown for states

const states: string[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas",
  "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana",
  "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah",
  "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

const stateSelect = document.querySelector<HTMLSelectElement>("#state");

if (stateSelect) {
  states.forEach((state) => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });
}

console.log("Number of state options:", stateSelect?.options.length);
