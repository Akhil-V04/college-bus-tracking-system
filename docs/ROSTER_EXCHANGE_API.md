# Annual Roster Exchange API

This contract supports the annual passenger-list workflow without creating passenger accounts. Administrators prepare and validate a **draft** roster; the currently published roster remains unchanged until the separate publish action succeeds.

## Canonical columns

Columns must appear in this order in generated files. Header matching during import is case-insensitive and accepts a small set of documented aliases.

| Column | Student | Faculty | Notes |
|---|---|---|---|
| Passenger Type | Required | Required | `STUDENT` or `FACULTY` |
| Name | Required | Required | Passenger display name |
| Bus Pass ID | Required | Required | Unique within the transport data |
| Student Roll Number | Required | Empty | Unique student identifier |
| Faculty ID | Empty | Required | Unique faculty identifier |
| Department | Required | Required | Department name/code |
| Year | Required | Empty | Student academic year |
| Section | Required | Empty | Student class section |
| Route Number | Required | Required | Operational route/bus number; treated as text so `08` stays `08` |
| Boarding Stop | Required | Required | Must match a stop in the route's published schedule |

Phone numbers are deliberately absent from templates and exports. They remain database fields visible only through administrator-authorized APIs.

## Endpoints

All endpoints require an administrator bearer token.

### Download a template

`GET /rosters/import/template?format=xlsx`

Use `format=csv` for a CSV template. The XLSX workbook includes instructions, an empty `Passengers` import sheet, non-importable examples, and the current route/stop reference.

### Preview a file

`POST /rosters/:rosterId/import/preview`

Send `multipart/form-data` with one field named `file`. Preview performs the same validation as import but never writes passengers. The response contains normalized rows, row-level errors and warnings, and valid/invalid totals.

### Import into a draft

`POST /rosters/:rosterId/import`

Send the same multipart request after the preview is clean. Import is allowed only for a draft roster. It locks and revalidates the roster inside a PostgreSQL transaction, inserts rows in chunks, and either commits every row or none. A successful import writes a `ROSTER_FILE_IMPORTED` administrator audit event.

### Export a complete roster

`GET /rosters/:rosterId/export?format=xlsx`

Use `format=csv` for CSV. Export is not paginated and contains the canonical columns only. A successful export writes a `ROSTER_EXPORTED` audit event and the response is marked `private, no-store`.

## Validation and safety rules

- CSV and XLSX are accepted; uploads are limited to 5 MB, 10,000 data rows, 30 columns, and 500 characters per cell.
- Spreadsheet formulas are rejected during XLSX import. CSV export neutralizes values beginning with `=`, `+`, `-`, or `@` to prevent formula injection.
- Bus pass IDs, student roll numbers, and faculty IDs must not conflict with the draft's existing rows or other uploaded rows.
- The route must exist, the boarding stop must be in its published schedule, and assigned passengers must not exceed that route's capacity. Existing draft passengers count toward capacity.
- Missing class-advisor coverage is returned as a warning so administrators can correct it before publication.
- Import re-runs validation after acquiring a database lock, preventing a clean preview from becoming an unsafe concurrent write.

## Recommended administrator workflow

1. Create or copy the next academic year's draft roster.
2. Download the latest template so route and stop references are current.
3. Fill the `Passengers` sheet without changing its headers.
4. Upload for preview and fix every error; review warnings.
5. Import the clean file into the draft.
6. Review counts and assignments in the admin system.
7. Publish the draft using the existing transactional publish action. The previous published roster is archived and passenger views switch to the new roster.
8. Export the archived roster for the college's controlled annual records. A browser download is not a substitute for an institution-managed backup policy.
