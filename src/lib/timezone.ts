import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { format } from 'date-fns'

const BERLIN_TZ = 'Europe/Berlin'

export const timezone = {
  /**
   * Get the current date and time in Berlin timezone
   */
  nowInBerlin: (): Date => {
    return toZonedTime(new Date(), BERLIN_TZ)
  },

  /**
   * Create a date in Berlin timezone for a specific year, month, and day
   */
  createDateInBerlin: (year: number, month: number, day: number): Date => {
    // Create date in Berlin timezone at noon to avoid DST issues
    const date = new Date(year, month, day, 12, 0, 0)
    return toZonedTime(date, BERLIN_TZ)
  },

  /**
   * Convert a date to Berlin timezone
   */
  toBerlinTime: (date: Date): Date => {
    return toZonedTime(date, BERLIN_TZ)
  },

  /**
   * Convert a Berlin timezone date back to UTC
   */
  fromBerlinTime: (berlinDate: Date): Date => {
    return fromZonedTime(berlinDate, BERLIN_TZ)
  },

  /**
   * Format a date in Berlin timezone
   */
  formatInBerlin: (date: Date, formatStr: string): string => {
    return formatInTimeZone(date, BERLIN_TZ, formatStr)
  },

  /**
   * Check if two dates are the same day in Berlin timezone
   */
  isSameDayInBerlin: (date1: Date, date2: Date): boolean => {
    const berlinDate1 = toZonedTime(date1, BERLIN_TZ)
    const berlinDate2 = toZonedTime(date2, BERLIN_TZ)
    return berlinDate1.toDateString() === berlinDate2.toDateString()
  },

  /**
   * Get the start of today in Berlin timezone
   */
  startOfTodayInBerlin: (): Date => {
    const now = toZonedTime(new Date(), BERLIN_TZ)
    now.setHours(0, 0, 0, 0)
    return now
  }
}