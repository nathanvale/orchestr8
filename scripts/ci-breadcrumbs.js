#!/usr/bin/env node
/* eslint-env node */
/* global module, require, process, console */
/**
 * CI Breadcrumb Navigation Helper
 *
 * Provides clear pipeline position indicators for ADHD-friendly CI/CD workflows.
 * Shows current stage, completed stages, and upcoming stages with visual indicators.
 */

/**
 * @typedef {Object} PipelineJob
 * @property {number} order - The order of the stage in the pipeline
 * @property {string} name - Display name of the stage
 * @property {string} emoji - Emoji representation of the stage
 * @property {string[]} [jobs] - Optional array of job names in this stage
 */

/**
 * @typedef {Object.<string, PipelineJob>} PipelineStages
 */

/**
 * @typedef {Object.<string, boolean>} CompletedJobs
 */

/**
 * @typedef {Object} NavigationOptions
 * @property {string} [currentJob] - The currently running job
 * @property {CompletedJobs} [completedJobs] - Object with job names as keys and completion status
 * @property {number} [totalJobs] - Total number of jobs in the pipeline
 * @property {boolean} [showTimeEstimate] - Whether to show time estimates
 */

/**
 * @typedef {Object.<string, number>} AverageDurations
 */

/** @type {PipelineStages} */
const PIPELINE_STAGES = {
  setup: { order: 1, name: 'Setup & Cache', emoji: '🔧' },
  quality: {
    order: 2,
    name: 'Code Quality',
    emoji: '✨',
    jobs: ['lint', 'format', 'typecheck'],
  },
  build: { order: 3, name: 'Build', emoji: '🔨' },
  test: {
    order: 4,
    name: 'Testing',
    emoji: '🧪',
    jobs: ['test-quick', 'test-focused', 'test-full'],
  },
  security: { order: 5, name: 'Security', emoji: '🔒' },
  bundle: { order: 6, name: 'Bundle Analysis', emoji: '📦' },
  status: { order: 7, name: 'Final Status', emoji: '📊' },
}

/**
 * Generates breadcrumb navigation based on current job
 * @param {string} currentJob - The currently running job
 * @param {CompletedJobs} [completedJobs] - Object with job names as keys and completion status
 * @returns {string} Formatted breadcrumb navigation
 */
function generateBreadcrumbs(currentJob, completedJobs = {}) {
  /** @type {string[]} */
  const stages = []
  /** @type {string | null} */
  let currentStage = null

  // Determine current stage
  Object.entries(PIPELINE_STAGES).forEach(([key, stage]) => {
    if ((stage.jobs && stage.jobs.includes(currentJob)) || key === currentJob) {
      currentStage = key
    }
  })

  // Build breadcrumb trail
  Object.entries(PIPELINE_STAGES).forEach(([key, stage]) => {
    const isCompleted = stage.jobs
      ? stage.jobs.every((job) => Boolean(completedJobs[job]))
      : Boolean(completedJobs[key])

    const isCurrent = key === currentStage
    const isPending = !isCompleted && !isCurrent

    let indicator = ''
    if (isCompleted) {
      indicator = '✅'
    } else if (isCurrent) {
      indicator = '🔄'
    } else if (isPending) {
      indicator = '⏳'
    }

    const stageText = `${indicator} ${stage.emoji} ${stage.name}`

    if (isCurrent) {
      stages.push(`**[${stageText}]**`)
    } else {
      stages.push(stageText)
    }
  })

  return stages.join(' → ')
}

/**
 * Generates progress bar based on completion percentage
 * @param {number} completed - Number of completed jobs
 * @param {number} total - Total number of jobs
 * @returns {string} Visual progress bar
 */
function generateProgressBar(completed, total) {
  const percentage = Math.round((completed / total) * 100)
  const filled = Math.floor(percentage / 10)
  const empty = 10 - filled

  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  return `\`${bar}\` ${percentage}%`
}

/**
 * Estimates remaining time based on average job duration
 * @param {string[]} remainingJobs - Array of remaining job names
 * @param {AverageDurations} [averageDurations] - Average duration for each job type
 * @returns {string} Estimated time remaining
 */
function estimateTimeRemaining(remainingJobs, averageDurations = {}) {
  /** @type {AverageDurations} */
  const defaultDurations = {
    'lint': 120,
    'format': 120,
    'typecheck': 180,
    'build': 300,
    'test-quick': 60,
    'test-focused': 180,
    'test-full': 600,
    'security': 300,
    'bundle': 300,
  }

  let totalSeconds = 0
  remainingJobs.forEach((job) => {
    totalSeconds += averageDurations[job] || defaultDurations[job] || 120
  })

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `~${minutes}m ${seconds}s remaining`
  }
  return `~${seconds}s remaining`
}

/**
 * Main function to generate complete navigation context
 * @param {NavigationOptions} [options] - Configuration options
 * @returns {string} Complete navigation context markdown
 */
function generateNavigationContext(options = {}) {
  const { currentJob = '', completedJobs = {}, totalJobs = 11, showTimeEstimate = true } = options

  const completedCount = Object.values(completedJobs).filter(Boolean).length
  const remainingJobs = Object.keys(PIPELINE_STAGES)
    .flatMap((stage) => PIPELINE_STAGES[stage]?.jobs || [stage])
    .filter((job) => !completedJobs[job])

  /** @type {string[]} */
  const sections = []

  // Pipeline position
  sections.push('### 🗺️ Pipeline Navigation')
  sections.push('')
  sections.push(generateBreadcrumbs(currentJob, completedJobs))
  sections.push('')

  // Progress indicator
  sections.push('### 📈 Overall Progress')
  sections.push('')
  sections.push(`**${completedCount}/${totalJobs} jobs completed**`)
  sections.push(generateProgressBar(completedCount, totalJobs))
  sections.push('')

  // Time estimate
  if (showTimeEstimate && remainingJobs.length > 0) {
    sections.push('### ⏱️ Time Estimate')
    sections.push('')
    sections.push(estimateTimeRemaining(remainingJobs))
    sections.push('')
  }

  // Current stage details
  if (currentJob) {
    sections.push('### 📍 Current Stage')
    sections.push('')
    const stageInfo = Object.entries(PIPELINE_STAGES).find(
      ([key, stage]) => (stage.jobs && stage.jobs.includes(currentJob)) || key === currentJob,
    )

    if (stageInfo) {
      const [, stage] = stageInfo
      sections.push(`Currently running: **${stage.emoji} ${stage.name}**`)
      if (stage.jobs) {
        sections.push(`Jobs in this stage: ${stage.jobs.join(', ')}`)
      }
    }
    sections.push('')
  }

  return sections.join('\n')
}

// Export for use in GitHub Actions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateBreadcrumbs,
    generateProgressBar,
    estimateTimeRemaining,
    generateNavigationContext,
    PIPELINE_STAGES,
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2)
  const currentJob = args[0] || ''
  const completedJobsStr = args[1] || '{}'

  try {
    /** @type {CompletedJobs} */
    const completedJobs = JSON.parse(completedJobsStr)
    const navigation = generateNavigationContext({
      currentJob,
      completedJobs,
    })

    console.log(navigation)
  } catch (error) {
    console.error('Error generating navigation:', error)
    process.exit(1)
  }
}
