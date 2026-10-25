# Mobile App Icons

This folder contains the icons used across the mobile app screens and buttons.
The app automatically switches between the default icon (light theme) and `*_white.png` (dark theme).

## Customizing / Adding Your Icons Manually
You can replace or drop your custom `.png` icon files into this directory.
**Keep the file names exactly the same** so the app dynamically renders your custom icons in both light and dark modes!

### Icon Mapping Table:

| Icon Key | Light Theme Icon (Default) | Dark Theme Icon (White) | Used In Screen / Button |
| :--- | :--- | :--- | :--- |
| **bus** | `bus.png` | `bus_white.png` | Header logo, route cards, search results |
| **passenger** | `passenger.png` | `passenger_white.png` | Role selection card ("Passenger") |
| **driver** | `driver.png` | `driver_white.png` | Role selection card ("Bus Driver") |
| **search** | `search.png` | `search_white.png` | "Search by Route Number" menu item & search screen |
| **pin** | `pin.png` | `pin_white.png` | "Bus Stop Near Me" menu item & search screen |
| **emergency** | `emergency.png` | `emergency_white.png` | "Emergency" SOS menu item & emergency screen |
| **report** | `report.png` | `report_white.png` | "Report an Issue" menu item & report screen |
| **assistant** | `assistant.png` | `assistant_white.png` | Floating AI Assistant Action Button (FAB) |
| **notifications** | `notifications.png` | `notifications_white.png` | Notification bell in top header |
| **route** | `route.png` | `route_white.png` | Route details, map & timeline |

### Notes for Custom Icons:
1. **Format**: Transparent PNG (`.png`).
2. **Recommended Dimensions**: 64x64 px or 96x96 px (square).
3. **Theming**:
   - `*.png` should have dark or branded colors (for light backgrounds).
   - `*_white.png` should have crisp white or bright lines (for dark mode backgrounds).
