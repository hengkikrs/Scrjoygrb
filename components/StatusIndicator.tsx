'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  SkipForward,
  XCircle,
} from 'lucide-react';
import type { AdbConnectionState, RecordStatus } from '@/lib/types';

export function RecordStatusText({ status }: { status: RecordStatus }) {
  switch (status) {
    case 'SUCCESS':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          SUCCESS
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
          IN_PROGRESS
        </span>
      );
    case 'NEEDS_REVIEW':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          NEEDS_REVIEW
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          FAILED
        </span>
      );
    case 'SKIPPED':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <SkipForward className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          SKIPPED
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          PENDING
        </span>
      );
  }
}

export function AdbStateText({ state }: { state: AdbConnectionState }) {
  switch (state) {
    case 'device':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
          Connected (device)
        </span>
      );
    case 'unauthorized':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Unauthorized
        </span>
      );
    case 'offline':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Offline
        </span>
      );
    case 'disconnected':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Disconnected
        </span>
      );
  }
}
