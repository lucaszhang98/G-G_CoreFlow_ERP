import prisma from '@/lib/prisma'

export async function getSystemConfigValue(key: string): Promise<string | null> {
  const row = await prisma.system_config.findUnique({
    where: { config_key: key },
    select: { config_value: true },
  })
  return row?.config_value ?? null
}

export async function setSystemConfigValue(
  key: string,
  value: string,
  description?: string,
  updatedBy?: bigint
): Promise<void> {
  await prisma.system_config.upsert({
    where: { config_key: key },
    create: {
      config_key: key,
      config_value: value,
      description,
      updated_by: updatedBy,
    },
    update: {
      config_value: value,
      description,
      updated_by: updatedBy,
      updated_at: new Date(),
    },
  })
}

export async function deleteSystemConfigValue(key: string): Promise<void> {
  await prisma.system_config.deleteMany({
    where: { config_key: key },
  })
}
