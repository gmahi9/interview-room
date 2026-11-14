import type { Category, Level, RoleInfo } from '../types';

export const ROLES: RoleInfo[] = [
  {
    id: 'software-engineer',
    label: 'Software engineer',
    blurb: 'Building, reviewing, and looking after software.',
  },
  {
    id: 'frontend',
    label: 'Frontend engineer',
    blurb: 'Interfaces, accessibility, and what the browser actually does.',
  },
  {
    id: 'backend',
    label: 'Backend engineer',
    blurb: 'APIs, data, and services that stay up.',
  },
  {
    id: 'data-engineer',
    label: 'Data engineer',
    blurb: 'Pipelines, models of the business, and data you can trust.',
  },
  {
    id: 'ml-engineer',
    label: 'Machine learning engineer',
    blurb: 'Training, evaluation, and serving a model in the real world.',
  },
  {
    id: 'devops',
    label: 'DevOps engineer',
    blurb: 'Delivery, infrastructure, and a calm on-call.',
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity',
    blurb: 'Access, risk, and how you respond when something looks wrong.',
  },
  {
    id: 'product-manager',
    label: 'Product manager',
    blurb: 'Discovery, priorities, and outcomes over output.',
  },
  {
    id: 'nurse',
    label: 'Nurse',
    blurb: 'Clinical judgment, handoffs, and patient advocacy.',
    disclaimer: 'Interview practice only. This is not clinical instruction or a substitute for supervision.',
  },
  {
    id: 'medical-assistant',
    label: 'Medical assistant',
    blurb: 'Patient flow, intake, and the limits of the role.',
    disclaimer: 'Interview practice only. This is not clinical instruction or a substitute for supervision.',
  },
  {
    id: 'electrician-apprentice',
    label: 'Electrician apprentice',
    blurb: 'Safety, trade basics, and how you work with a journeyman.',
    disclaimer: 'Interview practice only. This is not trade training. Follow your employer and the applicable code on the job.',
  },
  {
    id: 'sales-rep',
    label: 'Sales representative',
    blurb: 'Discovery, a honest pipeline, and earning the next step.',
  },
  {
    id: 'customer-service',
    label: 'Customer service',
    blurb: 'Calm, clarity, and a resolution the person can use.',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    blurb: 'Lessons, classroom judgment, and conversations with families.',
  },
  {
    id: 'behavioral',
    label: 'General behavioral',
    blurb: 'Stories that travel across roles and industries.',
  },
];

export const LEVEL_LABELS: Record<Level, string> = {
  entry: 'Entry',
  mid: 'Mid-level',
  senior: 'Senior',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  situational: 'Situational',
};

export function roleById(id: RoleInfo['id']): RoleInfo {
  const role = ROLES.find((item) => item.id === id);
  if (!role) throw new Error(`Unknown role ${id}`);
  return role;
}
