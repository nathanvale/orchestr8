#!/usr/bin/env node
/* global console, process */

/**
 * Build-time script to generate JSON Schema files from Zod schemas
 */

import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import the generation utilities
import { generateAllSchemas } from '../dist/esm/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generateSchemas() {
  console.log('🔧 Generating JSON Schemas...')

  try {
    // Output directory for generated schemas
    const outputDir = join(__dirname, '..', 'dist', 'schemas')

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true })
    console.log(`📁 Created output directory: ${outputDir}`)

    // Generate all schemas
    const schemas = generateAllSchemas({
      includeDescriptions: true,
      target: 'jsonSchema7',
      baseUri: 'https://orchestr8.io/schemas',
      includeExamples: true,
    })

    // Write each schema to a separate file
    for (const [name, schema] of Object.entries(schemas)) {
      const fileName = `${name}.schema.json`
      const filePath = join(outputDir, fileName)

      await writeFile(filePath, JSON.stringify(schema, null, 2), 'utf-8')

      console.log(`✅ Generated: ${fileName}`)
    }

    // Create an index file with metadata
    const indexContent = {
      schemas: Object.keys(schemas),
      baseUri: 'https://orchestr8.io/schemas',
      version: '1.0.0',
      generated: new Date().toISOString(),
    }

    await writeFile(
      join(outputDir, 'index.json'),
      JSON.stringify(indexContent, null, 2),
      'utf-8',
    )

    console.log('✅ Generated: index.json')
    console.log(
      `\n🎉 Successfully generated ${Object.keys(schemas).length} JSON Schema files!`,
    )
  } catch (error) {
    console.error('❌ Error generating schemas:', error)
    process.exit(1)
  }
}

// Run the generation
generateSchemas()
