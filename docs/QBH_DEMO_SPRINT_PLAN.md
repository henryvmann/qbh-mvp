
# QBH Demo Sprint Plan (13 Days)

## Demo Narrative

Start QBH
↓
Define household
↓
Connect accounts
↓
Provider discovery
↓
Dashboard overview
↓
User presses 'Handle It'
↓
AI calls doctor's office
↓
Appointment confirmed and written to dashboard

## Demo Goals
- Show real automation of care scheduling
- Demonstrate QBH as a health coordination hub
- Show the beginning of the broader health platform

## Demo Sprint Priorities

### Integrations
- Plaid financial connection
- One portal connection (FHIR sandbox)

### Product Polish
- Dashboard improvements
- Provider discovery realism
- UI polish for demo clarity

### Demo Narrative
- Smooth end‑to‑end flow
- Clear explanation of scheduling engine
- Highlight future platform capabilities


---

## Dashboard Evolution (Health OS Layout)

As QBH expands beyond scheduling into a **Health Operating System**, the dashboard will evolve from a provider list into a **health command center**.

The dashboard will present **summaries of each core system**, with links to dedicated pages for deeper interaction.

---

## Dashboard Structure

The dashboard should eventually follow this structure:

Daily Brief  
Goals  
Upcoming Care  
Providers  
Timeline  
Medications  
Caregivers  

Each section presents a **small snapshot** of information and links to its dedicated page.

Example relationships:

Dashboard (overview)

→ /goals  
→ /timeline  
→ /visits  
→ /medications  
→ /caregivers  

---

## Daily Brief (Top of Dashboard)

The **Daily Brief AI assistant** surfaces the most important information first.

Example:

Good morning Henry.

• Orthopedic appointment tomorrow  
• Physical therapy follow-up recommended  
• Prescription refill due in 5 days  

This section acts as the **primary health assistant interface**.

---

## Goals

Goals represent **intent and health direction**.

Example:

Goals

• Reduce back pain  
• Improve sleep quality  
• Continue therapy progress  

Goals help QBH guide care decisions and scheduling.

---

## Upcoming Care (Visits Snapshot)

The dashboard will include a **small calendar-style preview** of upcoming care.

Example:

Upcoming Care

June 12  
Orthopedic follow-up  

June 15  
Therapy session  

July 3  
Dermatology visit  

This data comes from:

calendar_events

The full visit management page will live at:

/visits

---

## Providers

Provider cards remain the main **care coordination interface**.

Each provider card includes:

- current scheduling status  
- upcoming appointment (if any)  
- **Handle It** button for AI scheduling  

---

## Timeline (Health History)

Timeline shows **historical health context**.

Example:

Timeline

2023 – Back injury  
2024 – MRI  
2024 – Physical therapy  
2025 – Orthopedic follow-up  

Detailed view:

/timeline

---

## Medications

Medication management will include:

- current prescriptions  
- refill reminders  
- interaction awareness  

Detailed view:

/medications

---

## Caregivers

Caregiver accounts allow **shared care coordination**.

Examples:

Parent managing elderly care  
Partner managing pregnancy  
Family managing chronic illness  

Detailed view:

/caregivers

---

## Implementation Approach (Current Sprint)

During the demo sprint we will:

1. Introduce **shell pages** for:

/goals  
/timeline  
/visits  
/medications  
/caregivers  

2. Add **dashboard snapshots** for these sections.

3. Avoid backend changes until after the demo.

The goal is to **signal the full product vision** while keeping the current scheduling system stable.

---

# Post-Demo Architecture Expansion

After the demo sprint, QBH will expand beyond scheduling into a **full Health Operating System**.

These systems are **not required for the demo**, but their structure should be documented early so the product evolves in a consistent direction.

---

## Visit Transcript Storage

QBH will store **structured summaries and transcripts from medical visits**.

This enables the system to capture important information patients often forget and allows future providers to understand prior care decisions.

Example stored data:

Visit  
Doctor: Dr. Smith  
Date: March 12  

Summary  
Discussed chronic knee pain and imaging results.

Diagnosis  
Meniscus degeneration.

Treatment Plan  
Physical therapy recommended for 6 weeks.

Follow-up  
Orthopedic reassessment in 8 weeks.

Potential future sources:

- Doctor visit recordings  
- Patient notes  
- Therapy session summaries  
- AI-generated summaries  

This becomes the foundation for the **patient's medical memory**.

---

## Medical Memory Model

The Medical Memory Model represents the **structured record of a patient’s health story**.

Example components:

Diagnoses  
Treatments  
Procedures  
Symptoms  
Medications  
Care events  

Example timeline:

2023 – Back injury  
2024 – MRI  
2024 – Physical therapy  
2025 – Orthopedic follow-up  

The goal is to create a **longitudinal health record** that removes the burden of remembering medical history from the patient.

---

## Medication System

QBH will eventually include a **medication management system**.

Core capabilities may include:

- active prescription tracking  
- refill reminders  
- dosage instructions  
- medication interaction awareness  
- pharmacy coordination  

Example medication snapshot:

Medication  
Gabapentin  

Purpose  
Nerve pain  

Dosage  
300mg daily  

Refill  
Due in 5 days  

This integrates with:

- visit summaries  
- provider recommendations  
- pharmacy refill workflows  

---

## Caregiver Permissions

QBH will support **shared care coordination through caregiver accounts**.

This allows trusted individuals to help manage care for patients who need assistance.

Examples:

Parent managing elderly care  
Partner managing pregnancy  
Family managing chronic illness  

Potential permission levels:

Viewer  
Can see appointments and summaries

Coordinator  
Can schedule visits and manage providers

Manager  
Full care management permissions

Caregiver permissions allow QBH to support **family-managed care networks**.

---

## Future QBH System Overview

These systems expand the QBH platform into a **Personal Health Operating System**.

Care Coordination Engine  
Scheduling • Follow-ups • Provider coordination  

Health Hub  
Goals • Providers • Visits • Timeline  

Medical Memory  
Diagnoses • Conversations • Care history  

Medication System  
Prescriptions • Refills • Reminders  

Caregiver Network  
Shared care coordination  

Together these systems enable QBH to:

- remember the patient's health story  
- coordinate care across providers  
- assist with ongoing treatment and wellness