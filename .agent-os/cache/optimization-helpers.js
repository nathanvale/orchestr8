#!/usr/bin/env node

/**
 * Optimization Helper Functions for 2025-01-16-test-optimization
 * Generated: 2025-09-16T22:00:00Z
 *
 * These functions support optimized context loading for execute-tasks agents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MANIFEST_PATH = '/Users/nathanvale/code/bun-changesets-template/.agent-os/cache/execution-manifest.json';
const CONTEXTS_PATH = '/Users/nathanvale/code/bun-changesets-template/.agent-os/cache/common-contexts.txt';

/**
 * GET_COMMON_CONTEXTS - Returns array of file paths that should be pre-loaded
 * @returns {string[]} Array of absolute file paths to pre-load
 */
function GET_COMMON_CONTEXTS() {
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        return manifest.optimization_plan.contexts_to_preload;
    } catch (error) {
        console.error('Failed to load common contexts:', error.message);
        return [];
    }
}

/**
 * GET_SECTION_CONTENT - Load specific section by hash from cached content
 * @param {string} filePath - Absolute path to the file
 * @param {string} sectionHash - Hash identifier for the section
 * @returns {string} Section content or full file if hash not found
 */
function GET_SECTION_CONTENT(filePath, sectionHash) {
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        const fileInfo = manifest.context_files[filePath];

        if (!fileInfo || !fileInfo.sections_needed) {
            // Fallback to full file load
            return fs.readFileSync(filePath, 'utf8');
        }

        // Find section by hash
        for (const [sectionKey, sectionData] of Object.entries(fileInfo.sections_needed)) {
            const hash = manifest.section_cache[sectionKey];
            if (hash === sectionHash) {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const [start, end] = sectionData.line_range;
                return lines.slice(start - 1, end).join('\n');
            }
        }

        // Hash not found, return full file
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('Failed to get section content:', error.message);
        return '';
    }
}

/**
 * SHOULD_PRELOAD - Check if specific file/section should be pre-loaded
 * @param {string} contextNameOrPath - Context name or file path
 * @returns {boolean} True if context should be preloaded
 */
function SHOULD_PRELOAD(contextNameOrPath) {
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

        // Check if it's a core context (always load)
        for (const [key, value] of Object.entries(manifest.core_context)) {
            if (value.path === contextNameOrPath || key === contextNameOrPath) {
                return true;
            }
        }

        // Check if it's in the pre-load list
        return manifest.optimization_plan.contexts_to_preload.includes(contextNameOrPath);
    } catch (error) {
        console.error('Failed to check preload status:', error.message);
        return false;
    }
}

/**
 * UPDATE_REGISTRY - Track file/section loading status
 * @param {string} action - 'load' or 'unload'
 * @param {string} contextIdentifier - File path or section hash
 * @returns {Object} Updated registry status
 */
function UPDATE_REGISTRY(action, contextIdentifier) {
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

        if (action === 'load') {
            if (contextIdentifier.includes('.md')) {
                // It's a file
                if (!manifest.context_registry.loaded_files.includes(contextIdentifier)) {
                    manifest.context_registry.loaded_files.push(contextIdentifier);
                }
            } else {
                // It's a section hash
                if (!manifest.context_registry.loaded_sections.includes(contextIdentifier)) {
                    manifest.context_registry.loaded_sections.push(contextIdentifier);
                }
            }
            manifest.context_registry.cache_hits++;
        } else if (action === 'unload') {
            manifest.context_registry.loaded_files = manifest.context_registry.loaded_files.filter(f => f !== contextIdentifier);
            manifest.context_registry.loaded_sections = manifest.context_registry.loaded_sections.filter(s => s !== contextIdentifier);
        }

        // Write back to manifest
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

        return {
            loaded_files: manifest.context_registry.loaded_files.length,
            loaded_sections: manifest.context_registry.loaded_sections.length,
            cache_hits: manifest.context_registry.cache_hits
        };
    } catch (error) {
        console.error('Failed to update registry:', error.message);
        return { error: error.message };
    }
}

/**
 * GET_FILE_PATH - Map abstract context name to actual file path
 * @param {string} contextName - Abstract context name
 * @returns {string|null} Absolute file path or null if not found
 */
function GET_FILE_PATH(contextName) {
    const contextMap = {
        'mission': '/Users/nathanvale/code/bun-changesets-template/.agent-os/product/mission-lite.md',
        'spec': '/Users/nathanvale/code/bun-changesets-template/.agent-os/specs/2025-01-16-test-optimization/spec-lite.md',
        'javascript_style': '/Users/nathanvale/code/bun-changesets-template/.agent-os/standards/code-style/javascript-style.md',
        'best_practices': '/Users/nathanvale/code/bun-changesets-template/.agent-os/standards/best-practices-comprehensive.md',
        'testing_guidelines': '/Users/nathanvale/code/bun-changesets-template/.agent-os/standards/testing-guidelines.md',
        'spec_testing': '/Users/nathanvale/code/bun-changesets-template/.agent-os/specs/2025-01-16-test-optimization/sub-specs/tests.md',
        'technical_spec': '/Users/nathanvale/code/bun-changesets-template/.agent-os/specs/2025-01-16-test-optimization/sub-specs/technical-design.md'
    };

    return contextMap[contextName] || null;
}

/**
 * GET_SECTION_RANGE - Get line numbers for partial loading
 * @param {string} filePath - Absolute path to file
 * @param {string} sectionId - Section identifier
 * @returns {Object|null} Object with start_line and end_line properties
 */
function GET_SECTION_RANGE(filePath, sectionId) {
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        const fileInfo = manifest.context_files[filePath];

        if (!fileInfo || !fileInfo.sections_needed) {
            return null;
        }

        const section = fileInfo.sections_needed[sectionId];
        if (!section || !section.line_range) {
            return null;
        }

        return {
            start_line: section.line_range[0],
            end_line: section.line_range[1],
            estimated_tokens: section.estimated_tokens,
            title: section.title
        };
    } catch (error) {
        console.error('Failed to get section range:', error.message);
        return null;
    }
}

/**
 * GET_OPTIMIZATION_STATS - Get current optimization statistics
 * @returns {Object} Statistics about token savings and efficiency
 */
function GET_OPTIMIZATION_STATS() {
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        return manifest.token_savings_analysis;
    } catch (error) {
        console.error('Failed to get optimization stats:', error.message);
        return null;
    }
}

// Export functions for use in execute-tasks agents
export {
    GET_COMMON_CONTEXTS,
    GET_SECTION_CONTENT,
    SHOULD_PRELOAD,
    UPDATE_REGISTRY,
    GET_FILE_PATH,
    GET_SECTION_RANGE,
    GET_OPTIMIZATION_STATS
};

// CLI interface for testing
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    switch (command) {
        case 'contexts':
            console.log(JSON.stringify(GET_COMMON_CONTEXTS(), null, 2));
            break;
        case 'preload':
            console.log(SHOULD_PRELOAD(args[0]));
            break;
        case 'path':
            console.log(GET_FILE_PATH(args[0]));
            break;
        case 'range':
            console.log(JSON.stringify(GET_SECTION_RANGE(args[0], args[1]), null, 2));
            break;
        case 'stats':
            console.log(JSON.stringify(GET_OPTIMIZATION_STATS(), null, 2));
            break;
        default:
            console.log('Usage: node optimization-helpers.js [contexts|preload|path|range|stats] [args...]');
            console.log('Examples:');
            console.log('  node optimization-helpers.js contexts');
            console.log('  node optimization-helpers.js preload mission');
            console.log('  node optimization-helpers.js path javascript_style');
            console.log('  node optimization-helpers.js range /path/to/file.md section_id');
            console.log('  node optimization-helpers.js stats');
    }
}