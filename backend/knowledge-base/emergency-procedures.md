# College Bus Emergency Procedures
**Document Type:** EMERGENCY  
**System:** College Bus Tracking System  
**Status:** TEMPLATE — verify with the college transport/safety authority

## 1. Passenger Emergency Reporting
Passengers can report:
- Breakdown
- Accident

The passenger report does not require login and is initially marked **UNVERIFIED**.

The system uses the affected bus's latest accepted GPS position as the incident location when available. It does not continuously track the passenger's location.

## 2. Emergency Verification
An authorized driver or administrator should review the report.

Possible incident states:
- REPORTED
- UNVERIFIED
- CONFIRMED
- ASSISTANCE_REQUESTED
- ASSISTANCE_ACCEPTED
- RESOLVED
- CANCELLED / FALSE_REPORT

A high number of similar reports or a high AI similarity score must not be treated as proof that an emergency is genuine.

## 3. Assistance
After an emergency is confirmed and assistance is requested:
1. The system identifies suitable nearby active buses.
2. Assistance offers are sent to eligible drivers.
3. Drivers may ACCEPT or DECLINE.
4. Drivers should only interact with the assistance workflow when safely stopped or otherwise in a safe condition.
5. The first valid accepted assistance assignment can become the active assistance assignment.
6. The affected driver and administrator are informed of the assignment.

The system must not infer empty seats from capacity data. Capacity is not the same as live occupancy.

## 4. Driver Safety
The application must not encourage unsafe phone interaction while driving.
- Drivers should follow college safety procedures.
- Emergency communication should be handled according to approved college policy.
- The system is a coordination tool and does not replace emergency services or official safety procedures.

## 5. Official Emergency Contacts
Replace the following placeholders with college-approved information:
- Campus security: VERIFY
- Transport office: VERIFY
- College emergency number: VERIFY
- Local emergency services: VERIFY

## 6. AI Assistant Boundary
The RAG Transport Assistant may explain approved emergency procedures from this document.
It must not invent emergency instructions, claim that an incident is confirmed, or replace authorized emergency response.

**Important:** This is a template and requires approval before being used as official emergency guidance.
