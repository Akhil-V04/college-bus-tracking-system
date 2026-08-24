import DataTable from './DataTable';

export default function Placeholder({ title }) {
  return (
    <DataTable
      columns={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }]}
      rows={[]}
      emptyLabel={`${title} screen — data entry comes in the next step`}
    />
  );
}