import EntityScreen from '../EntityScreen';

export default function DriversScreen() {
  return (
    <EntityScreen
      config={{
        title: 'Drivers',
        base: '/drivers',
        emptyLabel: 'No drivers have been added yet.',
        columns: [
          { key: 'driverCode', label: 'Driver code' },
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Private phone' },
          { key: 'licenseNo', label: 'Licence number' },
          {
            key: 'assignedRoute',
            label: 'Assigned route',
            render: (driver) => driver.assignedRoute
              ? `Route ${driver.assignedRoute.routeNo} — ${driver.assignedRoute.name}`
              : 'Not assigned',
          },
        ],
        fields: [
          { name: 'driverCode', label: 'Driver login code', type: 'text' },
          { name: 'name', label: 'Driver name', type: 'text' },
          { name: 'phone', label: 'Phone (admin-only)', type: 'text' },
          { name: 'licenseNo', label: 'Licence number', type: 'text' },
          {
            name: 'password',
            label: 'Login password (required when creating; leave blank to keep it while editing)',
            type: 'password',
          },
        ],
      }}
    />
  );
}