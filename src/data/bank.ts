import { backendQuestions } from './questions/backend';
import { behavioralQuestions } from './questions/behavioral';
import { cybersecurityQuestions } from './questions/cyber';
import { customerServiceQuestions } from './questions/service';
import { dataEngineerQuestions } from './questions/data';
import { devopsQuestions } from './questions/devops';
import { electricianQuestions } from './questions/electrician';
import { frontendQuestions } from './questions/frontend';
import { medicalAssistantQuestions } from './questions/medical';
import { mlEngineerQuestions } from './questions/ml';
import { nurseQuestions } from './questions/nurse';
import { productManagerQuestions } from './questions/product';
import { salesQuestions } from './questions/sales';
import { softwareEngineerQuestions } from './questions/software';
import { teacherQuestions } from './questions/teacher';
import type { Question } from '../types';

export const QUESTION_BANK: Question[] = [
  ...softwareEngineerQuestions,
  ...frontendQuestions,
  ...backendQuestions,
  ...dataEngineerQuestions,
  ...mlEngineerQuestions,
  ...devopsQuestions,
  ...cybersecurityQuestions,
  ...productManagerQuestions,
  ...nurseQuestions,
  ...medicalAssistantQuestions,
  ...electricianQuestions,
  ...salesQuestions,
  ...customerServiceQuestions,
  ...teacherQuestions,
  ...behavioralQuestions,
];
