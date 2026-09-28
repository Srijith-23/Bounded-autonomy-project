import { z } from 'zod';

export const CodeQualityResultSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  issues: z.array(z.any()).default([]),
});

export const TestCoverageResultSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  coveragePercentage: z.number().min(0).max(100).optional(),
  missingTests: z.array(z.any()).default([]),
});

export const RefactoringResultSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  suggestions: z.array(z.any()).default([]),
});

export const SummarySchema = z.object({
  overallScore: z.number().min(0).max(100),
  keyFindings: z.array(z.string()).default([]),
  codeQualityScore: z.number().min(0).max(100).optional(),
  testCoverageScore: z.number().min(0).max(100).optional(),
  refactoringScore: z.number().min(0).max(100).optional(),
});

export const ReviewReportSchema = z.object({
  summary: SummarySchema,
  agentResults: z.object({
    codeQuality: CodeQualityResultSchema,
    testCoverage: TestCoverageResultSchema,
    refactoring: RefactoringResultSchema,
  }),
});

export type ReviewReport = z.infer<typeof ReviewReportSchema>;