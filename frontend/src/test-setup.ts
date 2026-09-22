import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Tear down effects before individual test files restore their fetch mocks.
afterEach(() => cleanup())
