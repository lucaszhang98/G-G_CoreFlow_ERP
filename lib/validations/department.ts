import { z } from 'zod';

export const departmentCreateSchema = z.object({
  name: z.string()
    .min(1, '部门名称不能为空')
    .max(100, '部门名称长度不能超过 100'),
  code: z.string()
    .min(1, '部门代码不能为空')
    .max(20, '部门代码长度不能超过 20'),
  parent_id: z.number()
    .int()
    .positive()
    .optional(),
  manager_id: z.number()
    .int()
    .positive()
    .optional(),
  description: z.string().optional()
});

export const departmentUpdateSchema = departmentCreateSchema.partial();

export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

