import { Link } from 'react-router-dom';
import EntityScreen from '../EntityScreen';

export function RoutesScreen() {
  return (
    <EntityScreen
      config={{
        title: 'Routes',
        base: '/routes/crud',
        emptyLabel: 'No routes yet',
        columns: [
          { key: 'routeNo', label: 'Route No' },
          { key: 'name', label: 'Name' },
          { key: 'areaCovered', label: 'Area Covered' },
          {
            key: 'stops',
            label: '',
            render: (r) => (
              <Link to={`/routes/${r.id}`} className="text-blue-600 hover:underline">
                Manage stops
              </Link>
            ),
          },
        ],
        fields: [
          { name: 'routeNo', label: 'Route No', type: 'text' },
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'areaCovered', label: 'Area Covered', type: 'text' },
        ],
      }}
    />
  );
}

export function StopsScreen() {
  return (
    <EntityScreen
      config={{
        title: 'Stops',
        base: '/stops',
        emptyLabel: 'No stops yet',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'latitude', label: 'Latitude' },
          { key: 'longitude', label: 'Longitude' },
        ],
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'latitude', label: 'Latitude', type: 'number' },
          { name: 'longitude', label: 'Longitude', type: 'number' },
        ],
      }}
    />
  );
}

export function DriversScreen() {
  return (
    <EntityScreen
      config={{
        title: 'Drivers',
        base: '/drivers',
        emptyLabel: 'No drivers yet',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'licenseNo', label: 'License No' },
        ],
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
          { name: 'licenseNo', label: 'License No', type: 'text' },
          { name: 'passwordHash', label: 'Note: set password via seed-passwords endpoint (dev)', type: 'text', send: false },
        ],
      }}
    />
  );
}

export function ClassAdvisorsScreen() {
  return (
    <EntityScreen
      config={{
        title: 'Class Advisors',
        base: '/class-advisors',
        emptyLabel: 'No class advisors yet',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'department', label: 'Department' },
          { key: 'year', label: 'Year' },
          { key: 'section', label: 'Section' },
          { key: 'phone', label: 'Phone' },
        ],
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
          { name: 'department', label: 'Department', type: 'text' },
          { name: 'year', label: 'Year', type: 'number' },
          { name: 'section', label: 'Section', type: 'text' },
        ],
      }}
    />
  );
}