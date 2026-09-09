import EntityScreen from '../EntityScreen';

export default function ClassAdvisorsScreen() {
  return (
    <EntityScreen
      config={{
        title: 'Class Advisors',
        base: '/class-advisors',
        emptyLabel: 'No class-advisor mappings have been added yet.',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'department', label: 'Department' },
          { key: 'year', label: 'Year' },
          { key: 'section', label: 'Section' },
          { key: 'phone', label: 'Private phone' },
        ],
        fields: [
          { name: 'name', label: 'Advisor name', type: 'text' },
          { name: 'email', label: 'Advisor email', type: 'email' },
          { name: 'phone', label: 'Phone (admin-only)', type: 'text' },
          { name: 'department', label: 'Department', type: 'text' },
          { name: 'year', label: 'Academic year number', type: 'number' },
          { name: 'section', label: 'Section', type: 'text' },
        ],
      }}
    />
  );
}