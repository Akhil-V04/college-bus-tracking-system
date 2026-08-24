import { useEffect, useState } from 'react';
import EntityScreen from '../EntityScreen';
import api from '../api';

// Small hook to fetch option lists for dropdowns.
function useOptions(path, labelKey) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let active = true;
    api
      .get(path)
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.items || [];
        if (!active) return;
        setOptions(items.map((i) => ({ value: i.id, label: i[labelKey] ?? i.name ?? i.busNo })));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [path, labelKey]);
  return options;
}

export function BusesScreen() {
  const routes = useOptions('/routes', 'name');
  const drivers = useOptions('/drivers', 'name');

  return (
    <EntityScreen
      config={{
        title: 'Buses',
        base: '/buses',
        emptyLabel: 'No buses yet',
        columns: [
          { key: 'busNo', label: 'Bus No' },
          { key: 'plateNumber', label: 'Plate' },
          { key: 'capacity', label: 'Capacity' },
          {
            key: 'routeId',
            label: 'Route',
            render: (r) => (r.route ? `${r.route.routeNo} — ${r.route.name}` : '—'),
          },
          {
            key: 'driverId',
            label: 'Driver',
            render: (r) => (r.driver ? `${r.driver.name} (${r.driver.phone})` : '—'),
          },
        ],
        fields: [
          { name: 'busNo', label: 'Bus No', type: 'text' },
          { name: 'plateNumber', label: 'Plate Number', type: 'text' },
          { name: 'capacity', label: 'Capacity', type: 'number' },
          { name: 'routeId', label: 'Route', type: 'select', options: routes, placeholder: 'Select route' },
          { name: 'driverId', label: 'Driver', type: 'select', options: drivers, placeholder: 'Select driver (optional)' },
        ],
      }}
    />
  );
}

export function StudentsScreen() {
  const routes = useOptions('/routes', 'name');
  const stops = useOptions('/stops', 'name');

  return (
    <EntityScreen
      config={{
        title: 'Students',
        base: '/students',
        emptyLabel: 'No students yet',
        columns: [
          { key: 'rollNo', label: 'Roll No' },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'year', label: 'Year' },
          { key: 'department', label: 'Dept' },
          { key: 'section', label: 'Section' },
          {
            key: 'boardingStopId',
            label: 'Boarding Stop',
            render: (r) => (r.boardingStop ? r.boardingStop.name : '—'),
          },
        ],
        fields: [
          { name: 'rollNo', label: 'Roll No', type: 'text' },
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
          { name: 'year', label: 'Year', type: 'number' },
          { name: 'department', label: 'Department', type: 'text' },
          { name: 'section', label: 'Section', type: 'text' },
          { name: 'routeId', label: 'Route', type: 'select', options: routes, placeholder: 'Select route' },
          { name: 'boardingStopId', label: 'Boarding Stop', type: 'select', options: stops, placeholder: 'Select boarding stop' },
        ],
      }}
    />
  );
}