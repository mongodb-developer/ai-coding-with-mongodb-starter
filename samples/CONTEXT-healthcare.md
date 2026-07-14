# Healthcare Clinic Management

You are helping build a clinic management application. The application tracks patients, their visits, the diagnoses recorded at each visit, and the prescriptions issued. It is used by clinicians during visits and by administrative staff for billing and reporting.

## Source data

You have five CSV files in `~/project/data/`. They are normalized in a relational style and you are expected to reshape them into a document model that fits the application's access patterns.

**patients.csv** holds patient records. Each patient has a unique `patient_id`, a `first_name`, `last_name`, `date_of_birth`, `gender`, `email`, `phone`, a primary address (`address_line1`, `city`, `state`, `postal_code`, `country`), an `insurance_provider`, an `insurance_member_id`, an `emergency_contact_name`, and an `emergency_contact_phone`.

**visits.csv** holds visit records. Each visit has a unique `visit_id`, a `patient_id`, a `visit_date`, a `visit_type` (`annual_physical`, `acute_illness`, `follow_up`, `vaccination`, `mental_health`, `procedure`), an `attending_clinician`, a `chief_complaint`, vital signs (`bp_systolic`, `bp_diastolic`, `heart_rate`, `temperature_f`, `weight_lbs`, `height_in`), `notes`, and a `duration_minutes`. Visit types differ in which fields are clinically relevant: a vaccination visit has minimal vitals and a focus on the vaccine administered, a procedure visit has additional fields like procedure code and provider. The CSV captures all fields for all types but the values are sparse where they don't apply.

**diagnoses.csv** holds the diagnoses recorded at each visit. Each diagnosis has a unique `diagnosis_id`, a `visit_id`, a `patient_id` (denormalized for query convenience), an `icd10_code` (real ICD-10-CM codes), a `description`, a `diagnosis_type` (`primary`, `secondary`, `chronic`, `differential`), and a `status` (`active`, `resolved`, `ruled_out`).

**prescriptions.csv** holds the medications prescribed at each visit. Each prescription has a unique `prescription_id`, a `visit_id`, a `patient_id` (denormalized), a `medication_name`, a `generic_name`, a `dose`, a `dose_unit` (`mg`, `mcg`, `ml`, `units`), a `frequency` (`once_daily`, `twice_daily`, `every_8_hours`, etc.), a `duration_days`, a `refills`, and a `start_date`.

**audit_log.csv** holds an append-only record of meaningful state changes on the patient. Each entry has a unique `log_id`, a `subject_id` (the `patient_id` it applies to), a `subject_type` (always `patient` in this scenario), an `event_type` (`insurance_updated`, `address_updated`, `consent_signed`, `consent_withdrawn`, `appointment_scheduled`, `appointment_cancelled`, `appointment_no_show`, `portal_message_sent`, `chart_accessed`, `prescription_refill_requested`, and similar values), an `actor` (`user`, `clinician`, `admin`, or `system`), an `event_date` (ISO 8601 timestamp), and a free-text `details` summary. The collection is append-only: entries are never edited or deleted. It is universal across scenarios — the same shape exists in the financial and retail datasets, only the `event_type` values change.

## Application access patterns

These are the queries and operations the application performs. Your schema must serve them efficiently.

**Patient chart view.** When a clinician opens a patient's chart, the app loads the patient's demographics, their visit history sorted by date descending, their active diagnoses across all visits, and their current prescriptions. This is the most common query during a clinician's day.

**Visit detail.** When a clinician opens a specific visit, the app loads the visit details, all diagnoses recorded at that visit, all prescriptions issued at that visit, and the vitals captured.

**Record a visit.** When a clinician completes a visit, the app saves the visit record, all diagnoses recorded, and all prescriptions issued, in a single atomic operation.

**Reporting.** Administrative queries: list all visits in a date range, count patients by insurance provider, list active prescriptions for medication recall, list patients with a specific chronic diagnosis.

**Clinician schedule view.** A clinician views their visits scheduled for today or upcoming dates, sorted by visit time.

## Performance and scale

The chart view must be fast. Clinicians wait on it during a visit and a slow load is a usability failure. There are 1,000 patients, around 3,000 visits across all patients in a year, with 1 to 4 diagnoses per visit and 1 to 3 prescriptions per visit. The diagnoses and prescriptions collections are around 6,000 to 10,000 documents in a year.

## Notes for the schema

Visit types are heterogeneous. A vaccination visit and a procedure visit share the patient and visit metadata but differ in which clinical fields are populated. A polymorphic shape with a common base and type-specific fields is the natural fit.

Diagnoses and prescriptions belong to a visit but are also queried across visits for the patient (active chronic diagnoses, current prescriptions). The decision of whether to embed them in the visit or store them in their own collections has trade-offs that you should reason through explicitly.

Patient demographics change rarely. Visit records are immutable after they are signed. Prescriptions can be modified or refilled.

The patient chart view is a textbook case for thinking about access patterns first. If the chart view requires more than two or three queries to render, the schema is wrong.

Real ICD-10-CM codes are used in this dataset. Common codes include `J06.9` (acute upper respiratory infection), `I10` (essential hypertension), `E11.9` (type 2 diabetes mellitus without complications), `Z00.00` (encounter for general adult medical examination without abnormal findings), `M54.5` (low back pain), and `F41.9` (anxiety disorder).
