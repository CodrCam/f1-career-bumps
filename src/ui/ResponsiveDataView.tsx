import type { ReactNode } from 'react';

export interface DataColumn<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  mobileLabel?: string;
}

interface ResponsiveDataViewProps<T> {
  rows: T[];
  columns: Array<DataColumn<T>>;
  getKey: (row: T) => string;
  label: string;
  emptyMessage?: string;
}

export const ResponsiveDataView = <T,>({
  rows,
  columns,
  getKey,
  label,
  emptyMessage = 'No records match the current filters.',
}: ResponsiveDataViewProps<T>) => {
  if (!rows.length) {
    return <p className="analysis-empty">{emptyMessage}</p>;
  }

  return (
    <div className="analysis-data-view">
      <div className="analysis-table-scroll" tabIndex={0} aria-label={`Scrollable ${label}`}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  className={`align-${column.align ?? 'left'}`}
                  key={column.id}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)}>
                {columns.map((column, index) => (
                  index === 0
                    ? (
                      <th key={column.id} scope="row">
                        {column.render(row)}
                      </th>
                    )
                    : (
                      <td
                        className={`align-${column.align ?? 'left'}`}
                        key={column.id}
                      >
                        {column.render(row)}
                      </td>
                    )
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="analysis-mobile-list" aria-label={label}>
        {rows.map((row) => (
          <li key={getKey(row)}>
            <div className="analysis-mobile-list__primary">
              {columns[0].render(row)}
            </div>
            <dl>
              {columns.slice(1).map((column) => (
                <div key={column.id}>
                  <dt>{column.mobileLabel ?? column.header}</dt>
                  <dd>{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
};
