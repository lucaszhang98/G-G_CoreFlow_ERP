/**
 * 与 createListHandler（应收）一致的 where 构建，供导出等需「与列表同筛选」的场景复用。
 */

import type { EntityConfig } from '@/lib/crud/types'
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator'
import { buildRelationFilterCondition } from '@/lib/crud/relation-filter-helper'

export function buildReceivableListWhere(
  config: EntityConfig,
  searchParams: URLSearchParams
): Record<string, unknown> {
  const enhancedConfig = enhanceConfigWithSearchFields(config)
  const where: Record<string, unknown> = {}

  const search = searchParams.get('search') || ''
  if (search.trim()) {
    const searchConditions: Record<string, unknown>[] = []
    if (enhancedConfig.prisma?.model === 'receivables') {
      searchConditions.push({
        invoices: {
          invoice_number: { contains: search, mode: 'insensitive' as const },
        },
      })
    }
    if (searchConditions.length > 0) {
      where.OR = searchConditions
    }
  }

  if (enhancedConfig.list.filterFields) {
    enhancedConfig.list.filterFields.forEach((filterField) => {
      if (filterField.type === 'select') {
        const filterValue = searchParams.get(`filter_${filterField.field}`)
        if (filterValue && filterValue !== '__all__') {
          const fieldConfig = enhancedConfig.fields[filterField.field]
          if (fieldConfig?.type === 'relation' || fieldConfig?.type === 'location') {
            const relationCondition = buildRelationFilterCondition(
              filterField,
              filterValue,
              enhancedConfig
            )
            if (relationCondition) {
              Object.assign(where, relationCondition)
            }
          } else if (
            enhancedConfig.prisma?.model === 'receivables' &&
            filterField.field === 'invoice_type'
          ) {
            where.invoices = { invoice_type: filterValue }
          } else {
            where[filterField.field] = filterValue
          }
        }
      } else if (filterField.type === 'dateRange') {
        const dateFrom = searchParams.get(`filter_${filterField.field}_from`)
        const dateTo = searchParams.get(`filter_${filterField.field}_to`)
        if (dateFrom || dateTo) {
          const dateCondition: Record<string, Date> = {}
          if (dateFrom) {
            dateCondition.gte = new Date(dateFrom)
          }
          if (dateTo) {
            const endDate = new Date(dateTo)
            endDate.setHours(23, 59, 59, 999)
            dateCondition.lte = endDate
          }
          if (filterField.dateFields && filterField.dateFields.length > 1) {
            const orConditions = filterField.dateFields.map((dateField) => ({
              [dateField]: dateCondition,
            }))
            if (!where.AND) where.AND = []
            ;(where.AND as unknown[]).push({ OR: orConditions })
          } else if (filterField.dateFields && filterField.dateFields.length === 1) {
            where[filterField.dateFields[0]] = dateCondition
          } else {
            where[filterField.field] = dateCondition
          }
        }
      } else if (filterField.type === 'numberRange') {
        const numMin = searchParams.get(`filter_${filterField.field}_min`)
        const numMax = searchParams.get(`filter_${filterField.field}_max`)
        if (numMin || numMax) {
          const numCondition: Record<string, number> = {}
          if (numMin) numCondition.gte = Number(numMin)
          if (numMax) numCondition.lte = Number(numMax)
          if (filterField.numberFields && filterField.numberFields.length > 1) {
            const orConditions = filterField.numberFields.map((numField) => ({
              [numField]: numCondition,
            }))
            if (!where.AND) where.AND = []
            ;(where.AND as unknown[]).push({ OR: orConditions })
          } else if (filterField.numberFields && filterField.numberFields.length === 1) {
            where[filterField.numberFields[0]] = numCondition
          } else {
            where[filterField.field] = numCondition
          }
        }
      }
    })
  }

  const advancedLogic = searchParams.get('advanced_logic') || 'AND'
  const advFields = enhancedConfig.list.advancedSearchFields
  if (advFields && advFields.length > 0) {
    const advancedConditions: Record<string, unknown>[] = []

    advFields.forEach((searchField) => {
      if (searchField.type === 'text' || searchField.type === 'number') {
        const value = searchParams.get(`advanced_${searchField.field}`)
        if (value) {
          if (searchField.type === 'text') {
            advancedConditions.push({
              [searchField.field]: { contains: value, mode: 'insensitive' as const },
            })
          } else {
            advancedConditions.push({
              [searchField.field]: Number(value),
            })
          }
        }
      } else if (searchField.type === 'date' || searchField.type === 'datetime') {
        const value = searchParams.get(`advanced_${searchField.field}`)
        if (value) {
          advancedConditions.push({
            [searchField.field]: new Date(value),
          })
        }
      } else if (searchField.type === 'select') {
        const value = searchParams.get(`advanced_${searchField.field}`)
        if (value && value !== '__all__') {
          advancedConditions.push({
            [searchField.field]: value,
          })
        }
      } else if (searchField.type === 'dateRange') {
        const dateFrom = searchParams.get(`advanced_${searchField.field}_from`)
        const dateTo = searchParams.get(`advanced_${searchField.field}_to`)
        if (dateFrom || dateTo) {
          const dateCondition: Record<string, Date> = {}
          if (dateFrom) dateCondition.gte = new Date(dateFrom)
          if (dateTo) {
            const endDate = new Date(dateTo)
            endDate.setHours(23, 59, 59, 999)
            dateCondition.lte = endDate
          }
          if (searchField.dateFields && searchField.dateFields.length > 0) {
            searchField.dateFields.forEach((dateField) => {
              advancedConditions.push({ [dateField]: dateCondition })
            })
          } else {
            advancedConditions.push({ [searchField.field]: dateCondition })
          }
        }
      } else if (searchField.type === 'numberRange') {
        const numMin = searchParams.get(`advanced_${searchField.field}_min`)
        const numMax = searchParams.get(`advanced_${searchField.field}_max`)
        if (numMin || numMax) {
          const numCondition: Record<string, number> = {}
          if (numMin) numCondition.gte = Number(numMin)
          if (numMax) numCondition.lte = Number(numMax)
          if (searchField.numberFields && searchField.numberFields.length > 0) {
            searchField.numberFields.forEach((numField) => {
              advancedConditions.push({ [numField]: numCondition })
            })
          } else {
            advancedConditions.push({ [searchField.field]: numCondition })
          }
        }
      }
    })

    if (advancedConditions.length > 0) {
      if (advancedLogic === 'OR') {
        if (where.OR) {
          where.OR = [...(where.OR as unknown[]), ...advancedConditions]
        } else {
          where.OR = advancedConditions
        }
      } else {
        if (advancedConditions.length === 1) {
          Object.assign(where, advancedConditions[0])
        } else {
          where.AND = advancedConditions
        }
      }
    }
  }

  if (where.OR && Array.isArray(where.OR) && where.OR.length === 0) {
    delete where.OR
  }
  if (where.AND && Array.isArray(where.AND) && where.AND.length === 0) {
    delete where.AND
  }

  return where
}
