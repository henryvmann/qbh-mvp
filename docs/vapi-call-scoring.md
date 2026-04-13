# Kate Call Scoring Rubric

Use this in the VAPI dashboard **Analysis** tab to score each call.

## Scoring Categories (each 1-5)

### 1. Opening (1-5)
- 5: Natural greeting, used patient's full name AND provider/doctor name, didn't talk over IVR
- 4: Good greeting, minor issue (slightly awkward phrasing)
- 3: Used patient name but missed doctor name, or slight delay
- 2: Missing last name, or talked over automated system
- 1: Failed to introduce properly, or spoke during IVR menu

### 2. Information Handling (1-5)
- 5: Gave info only when asked, correct pacing (insurance name first, paused for member ID), all info accurate
- 4: Gave info correctly but slightly too fast or volunteered one extra piece
- 3: Rattled off insurance + member ID together, or gave info before being asked
- 2: Got info wrong, or couldn't provide basic info (DOB, insurance)
- 1: Made up information or caused confusion

### 3. New/Existing Patient (1-5)
- 5: Correctly identified patient status and answered confidently
- 4: Gave a reasonable answer with slight hedging
- 3: Said "not sure" but offered to have office look up
- 2: Got it wrong (said new when existing, or vice versa)
- 1: Completely confused or contradicted themselves

### 4. Objection Handling (1-5)
- 5: Handled referral/insurance/availability issues proactively — tried to still book, asked follow-up questions, gathered useful info
- 4: Handled most objections well, missed one follow-up opportunity
- 3: Accepted objections too quickly but remained professional
- 2: Gave up immediately on first objection
- 1: Got flustered or said something incorrect

### 5. Conversation Flow (1-5)
- 5: Natural pacing, didn't interrupt, appropriate pauses, mirrored receptionist's energy
- 4: Mostly natural with one awkward moment
- 3: Slightly robotic or rushed in places
- 2: Frequently interrupted or had long awkward pauses
- 1: Clearly robotic, talked over people, or monologued

### 6. Outcome (1-5)
- 5: Appointment booked successfully
- 4: Gathered all necessary info even if not booked (referral details, insurance alternatives, callback info)
- 3: Ended gracefully but missed gathering some useful info
- 2: Ended call without gathering actionable info
- 1: Call ended badly (hung up on, confused ending, or error)

## VAPI Analysis Tab Setup

In your VAPI assistant's **Analysis** tab, add these as success evaluation criteria:

**Success Evaluation Prompt:**
```
Evaluate this call on these criteria (score each 1-5):
1. Opening: Did Kate use the patient's full name? Did she wait for IVR menus to finish?
2. Information: Did she pace insurance info correctly? Did she only give info when asked?
3. Patient Status: Did she correctly identify new vs existing?
4. Objection Handling: Did she try to still book when told about referrals/insurance issues?
5. Flow: Was the conversation natural? Did she interrupt or get interrupted?
6. Outcome: Was an appointment booked? If not, did she gather useful info?

Overall score: average of all 6. 
4.0+ = Good
3.0-3.9 = Needs improvement
Below 3.0 = Needs significant prompt changes
```

**Structured Data Extraction:**
```
Extract: appointment_booked (boolean), referral_needed (boolean), insurance_accepted (boolean), 
patient_status_correct (boolean), doctor_name_identified (string or null), 
callback_requested (boolean), key_issues (array of strings)
```
