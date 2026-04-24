import { validatePassportPhotoPayload } from '../../workers/passportValidationWorker.js';

const WORKER_BOOT_TIMEOUT_MS = 8000;

function runPassportValidationOnMainThread(payload, options = {}) {
  return validatePassportPhotoPayload(payload, {
    onStageChange: options.onStageChange,
  });
}

export function runPassportValidationWorker(payload, options = {}) {
  const { onStageChange } = options;

  return new Promise((resolve, reject) => {
    let worker = null;
    const requestId = `passport-validation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let completed = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (worker) {
        worker.terminate();
        worker = null;
      }
    };

    const resolveOnce = (result) => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
      resolve(result);
    };

    const rejectOnce = (error) => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
      reject(error);
    };

    const fallbackToMainThread = async (error) => {
      if (completed) {
        return;
      }

      cleanup();

      try {
        const result = await runPassportValidationOnMainThread(payload, {
          onStageChange,
        });
        resolveOnce(result);
      } catch (fallbackError) {
        rejectOnce(
          fallbackError instanceof Error
            ? fallbackError
            : error instanceof Error
              ? error
              : new Error('Validation worker failed.'),
        );
      }
    };

    try {
      worker = new Worker(
        new URL('../../workers/passportValidationWorker.js', import.meta.url),
        { type: 'module' },
      );
    } catch (error) {
      fallbackToMainThread(error);
      return;
    }

    timeoutId = globalThis.setTimeout(() => {
      fallbackToMainThread(new Error('Validation worker failed to start.'));
    }, WORKER_BOOT_TIMEOUT_MS);

    worker.addEventListener('message', (event) => {
      if (completed) {
        return;
      }

      const message = event.data;

      if (!message || message.requestId !== requestId) {
        return;
      }

      if (message.type === 'stage') {
        onStageChange?.(message.stageKey);
        return;
      }

      if (message.type === 'result') {
        resolveOnce(message.result);
        return;
      }

      if (message.type === 'error') {
        fallbackToMainThread(new Error(message.error || 'Validation worker failed.'));
      }
    });

    worker.addEventListener('error', (event) => {
      fallbackToMainThread(event.error || new Error('Validation worker failed to start.'));
    });

    worker.addEventListener('messageerror', () => {
      fallbackToMainThread(new Error('Validation worker could not transfer data.'));
    });

    try {
      worker.postMessage({
        type: 'validate',
        requestId,
        payload,
      });
    } catch (error) {
      fallbackToMainThread(error);
    }
  });
}
