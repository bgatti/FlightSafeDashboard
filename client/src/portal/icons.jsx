/**
 * Shared icon components for portal pages.
 * Tabler Icons — sharp, geometric, dashboard-grade SVGs.
 * Thin stroke (1.25), neutral slate tones by default.
 */
import {
  IconPlane, IconPlaneTilt, IconPlaneDeparture, IconPlaneArrival,
  IconWind, IconTemperature, IconCloud, IconSunset2, IconMountain,
  IconEye, IconRuler2, IconGauge,
  IconClock, IconHourglass, IconCalendarEvent,
  IconUsers, IconUser, IconUserCheck,
  IconBook2, IconSchool, IconCertificate, IconClipboardCheck, IconFileText,
  IconTool, IconShieldCheck, IconAlertTriangle,
  IconCurrencyDollar, IconChartBar, IconReceipt,
  IconChevronRight, IconChevronDown, IconX, IconPlus, IconMinus,
  IconStar, IconInfoCircle, IconExternalLink,
  IconCompass, IconRoute, IconMap,
  IconActivity, IconWaveSine,
  IconScale, IconWeight,
  IconBrandSpeedtest, IconPropeller,
  IconMapPin, IconListDetails, IconDeviceGamepad2,
  // STEM & sector icons
  IconAtom, IconFlask, IconMathSymbols, IconEngine,
  IconBriefcase, IconShieldLock, IconHelicopter, IconTruck,
  IconBuildingHospital, IconRadar, IconSatellite, IconBrain,
  IconMicroscope, IconCalculator, IconSettingsAutomation,
  // Noise / community icons
  IconVolume, IconVolumeOff, IconEar, IconHomeHeart,
  IconFlame, IconFirstAidKit, IconMessageCircle, IconSend,
  IconHeartHandshake, IconThumbUp,
} from '@tabler/icons-react'

// Defaults: sharp, thin, small, neutral
const D = { size: 16, stroke: 1.25 }
const wrap = (Icon) => (props) => <Icon {...D} {...props} />

// ── Flight log categories ──
export const IcDual       = wrap(IconUsers)
export const IcSolo       = wrap(IconUser)
export const IcXC         = wrap(IconRoute)
export const IcNight      = wrap(IconSunset2)
export const IcInstrument = wrap(IconCloud)
export const IcGround     = wrap(IconBook2)

// ── Weather & operations ──
export const IcField      = wrap(IconMountain)
export const IcRunway     = wrap(IconPlaneArrival)
export const IcWind       = wrap(IconWind)
export const IcTemp       = wrap(IconTemperature)
export const IcDensityAlt = wrap(IconGauge)
export const IcVisibility = wrap(IconEye)
export const IcCloudBase  = wrap(IconCloud)
export const IcSunset     = wrap(IconSunset2)
export const IcTowPlane   = wrap(IconPlaneDeparture)
export const IcQueue      = wrap(IconClock)
export const IcWait       = wrap(IconHourglass)
export const IcThermals   = wrap(IconActivity)

// ── Navigation ──
export const IcHome       = wrap(IconCompass)
export const IcFlights    = wrap(IconMap)
export const IcPlan       = wrap(IconPlaneDeparture)
export const IcMaint      = wrap(IconTool)
export const IcFBO        = wrap(IconMapPin)
export const IcPOS        = wrap(IconReceipt)
export const IcBusiness   = wrap(IconChartBar)
export const IcLeases     = wrap(IconFileText)
export const IcTraining   = wrap(IconSchool)
export const IcGlider     = wrap(IconPlaneTilt)
export const IcMountain   = wrap(IconMountain)
export const IcMgmt       = wrap(IconClipboardCheck)
export const IcSim        = wrap(IconDeviceGamepad2)
export const IcReports    = wrap(IconListDetails)
export const IcSchedule   = wrap(IconCalendarEvent)
export const IcGallery    = wrap(IconCompass)
export const IcLeaderboard = wrap(IconCertificate)

// ── Start Soaring section ──
export const IcBird       = wrap(IconPlaneTilt)
export const IcPeak       = wrap(IconMountain)
export const IcTimer      = wrap(IconClock)
export const IcMoney      = wrap(IconCurrencyDollar)
export const IcChart      = wrap(IconChartBar)
export const IcWave       = wrap(IconWaveSine)

// ── STEM & sector ──
export const IcScience     = wrap(IconAtom)
export const IcTechnology  = wrap(IconRadar)
export const IcEngineering = wrap(IconEngine)
export const IcMath        = wrap(IconMathSymbols)
export const IcFlask       = wrap(IconFlask)
export const IcMicroscope  = wrap(IconMicroscope)
export const IcCalculator  = wrap(IconCalculator)
export const IcBrain       = wrap(IconBrain)
export const IcSatellite   = wrap(IconSatellite)
export const IcCareer      = wrap(IconBriefcase)
export const IcAIHardened  = wrap(IconShieldLock)
export const IcMedical     = wrap(IconBuildingHospital)
export const IcHelicopter  = wrap(IconHelicopter)
export const IcLogistics   = wrap(IconTruck)
export const IcAutomation  = wrap(IconSettingsAutomation)

// ── Noise / community ──
export const IcVolume     = wrap(IconVolume)
export const IcVolumeOff  = wrap(IconVolumeOff)
export const IcEar        = wrap(IconEar)
export const IcHomeHeart  = wrap(IconHomeHeart)
export const IcFire       = wrap(IconFlame)
export const IcFirstAid   = wrap(IconFirstAidKit)
export const IcMessage    = wrap(IconMessageCircle)
export const IcSend       = wrap(IconSend)
export const IcSupport    = wrap(IconHeartHandshake)
export const IcThumbUp    = wrap(IconThumbUp)

// ── General utility ──
export const IcPlane      = wrap(IconPlane)
export const IcStar       = wrap(IconStar)
export const IcCheck      = wrap(IconShieldCheck)
export const IcInfo       = wrap(IconInfoCircle)
export const IcExtLink    = wrap(IconExternalLink)
export const IcPlus2      = wrap(IconPlus)
export const IcMinus2     = wrap(IconMinus)
export const IcClose      = wrap(IconX)
export const IcChevRight  = wrap(IconChevronRight)
export const IcChevDown   = wrap(IconChevronDown)
export const IcAlert      = wrap(IconAlertTriangle)
export const IcShield     = wrap(IconShieldCheck)
export const IcWeight     = wrap(IconWeight)
export const IcScale2     = wrap(IconScale)
export const IcPropeller  = wrap(IconPropeller)

// ── Emoji → Tabler mapping for data-driven rendering ──
export const ICON_MAP = {
  '⛰️': IcField, '🛬': IcRunway, '💨': IcWind, '🌡️': IcTemp,
  '📏': IcDensityAlt, '👁️': IcVisibility, '☁️': IcCloudBase, '🌅': IcSunset,
  '🛩️': IcTowPlane, '⏱️': IcQueue, '⏳': IcWait, '🌀': IcThermals,
  '👨‍✈️': IcDual, '🧑‍✈️': IcSolo, '🗺️': IcXC, '🌙': IcNight,
  '📚': IcGround,
  '🦅': IcBird, '🏔️': IcPeak, '💰': IcMoney, '📊': IcChart, '🌊': IcWave,
}

/**
 * Renders a Tabler icon if the emoji has a mapping, otherwise renders the emoji as-is.
 * <PortalIcon emoji="⛰️" className="text-slate-400" size={20} />
 */
export function PortalIcon({ emoji, size, className = '', ...rest }) {
  const Comp = ICON_MAP[emoji]
  if (Comp) return <Comp size={size || 16} className={className} {...rest} />
  return <span className={className}>{emoji}</span>
}
