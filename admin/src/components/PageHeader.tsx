import React from 'react';
import { Space, Typography } from 'antd';

const { Title } = Typography;

interface PageHeaderProps {
  title: React.ReactNode;
  /** Buttons and filters shown on the right, e.g. a refresh button. */
  actions?: React.ReactNode;
  /** Sub-line under the title, e.g. a count or a hint. */
  description?: React.ReactNode;
}

/**
 * Page title row shared by the admin screens: title on the left, actions on
 * the right, wrapping instead of overflowing on narrow viewports.
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  actions,
  description,
}) => (
  <div style={{ marginBottom: 24 }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <Title level={2} style={{ margin: 0 }}>
        {title}
      </Title>
      {actions ? <Space wrap>{actions}</Space> : null}
    </div>
    {description ? (
      <div style={{ marginTop: 8, color: 'rgba(0, 0, 0, 0.45)' }}>
        {description}
      </div>
    ) : null}
  </div>
);

export default PageHeader;
