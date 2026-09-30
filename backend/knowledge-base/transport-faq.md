# College Transport FAQ
**Document Type:** FAQ  
**System:** College Bus Tracking System  
**Status:** TEMPLATE — verify college-specific facts before production

## 1. Do I need an account to track a bus?
No. The passenger application is designed for students and faculty to use without creating an account.

## 2. How do I select my bus route?
Open the passenger app and select your **route number** from the available college routes. Route selection is manual and does not require passenger login.

## 3. Can I see the bus live?
When a trip is active and reliable GPS data is available, the application can show the bus's current location and estimated arrival information.

## 4. Is the ETA guaranteed?
No. ETA is an estimate. Traffic, stopping time, GPS quality, network interruption, route conditions, and other factors can change the arrival time.

## 5. What happens if GPS is unavailable?
The application should show an explicit state such as **NO_LIVE_DATA**, **STALE_LOCATION**, or another appropriate uncertainty state. It may provide schedule-based information where appropriate rather than pretending that a precise live ETA is known.

## 6. What does "Off Route" mean?
It means the system cannot currently establish reliable progress along the configured route. The application should show the off-route state instead of giving an unjustifiably precise ETA.

## 7. Can I report a bus problem?
Yes. Use **Report an Issue** and select the appropriate category, such as driver behaviour, driving/safety, bus condition, route/stop issue, schedule issue, app issue, or other.

## 8. Why might my issue appear together with another report?
The system can use AI-based semantic similarity to identify reports that appear to describe the same or a related problem. Individual reports remain preserved as evidence for administrator review.

## 9. Does AI grouping mean the complaint is confirmed?
No. Semantic similarity only indicates that reports may be related. Administrators must review the reports before treating an issue as confirmed or resolved.

## 10. What is the Transport Assistant?
The Transport Assistant is a RAG-based question-answering feature. It retrieves relevant information from approved college transport documents and uses that information to generate a grounded response.

## 11. Can I ask the Transport Assistant where my bus is right now?
Live bus location and ETA should come from the real-time tracking system. The RAG assistant should not invent a live location from static documents.

## 12. What if the Transport Assistant cannot find the answer?
It should say that the available transport documents do not contain enough information instead of fabricating a college rule.

## 13. Will I receive an alert if my route is delayed?
The system can identify a predicted late route and notify the appropriate class advisors about students assigned to that route. This does not mean the system has confirmed which students boarded the bus.

## 14. Can I receive a stop-arrival notification?
If the feature is enabled, a passenger can configure route/stop notification thresholds such as 10, 5, or 1 minute before the estimated arrival. Notifications are tied to the selected trip and are deduplicated.

## 15. Can I report a bus emergency?
Yes. A passenger can report a breakdown or accident. The initial report is unverified until an authorized driver or administrator confirms it.

## 16. Is passenger location stored?
The Bus Stop Near Me feature uses device location only after explicit permission. The passenger's location should not be permanently stored for this feature.

## 17. Does the system track daily attendance or boarding?
No. The project does not use QR boarding scans or daily passenger attendance tracking.

## 18. What college-specific information is still pending?
Official route timings, service-calendar rules, emergency contacts, transport-office details, and other college-specific policies must be supplied and approved by the college before production use.
