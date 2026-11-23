# Microphone audio

The toolbar calls `AudioEngine.start()` in the click handler. The engine requests a microphone stream and creates and resumes one AudioContext for that session. The graph ends at an AnalyserNode, with no connection to the audio destination. The active visualizer reads live features from the same engine while the microphone is active.

`getFeatures()` samples on demand and returns a borrowed frame. The engine reuses the waveform and spectrum buffers each time it samples. Consumers can read them synchronously and must copy them if they need a stable snapshot. Only four rounded meter values enter React state, at up to 20 updates per second.

The 4096-point FFT uses the AudioContext sample rate to locate bins. The waveform and RMS use normalized sample amplitudes. The display spectrum maps −80 to −12 dB to the 0–1 range. Band levels sum bin power before mapping onto the same display range. Scalar levels use time-based attack and release smoothing. Levels are relative to the input device and browser processing.

Stop releases the stream, disconnects the graph and closes the context. Cancellation during a permission prompt discards any stream that arrives afterward. The browser owns the prompt and can leave it pending indefinitely. Resolve or dismiss it before starting another request.

## Manual check

1. Run `npm run dev` and open the localhost URL in a browser.
2. Click **Start Microphone** and allow access. Speak into the microphone and watch the four meters. The stage switches to Live Audio. Try low frequencies to see the bloom expand, and louder input to see it brighten.
3. Switch through **Waveform Flow**, **Circular Spectrum**, and **Particle Bloom** while the microphone is active. Confirm the meters and Live Audio stay on without another permission prompt.
4. Click **Stop Microphone**. Check that the meters disappear, the stage returns to Demo Mode, and the browser's microphone-use indicator clears. Start again to check restart.
5. Test denial by resetting site microphone permissions and denying the next request. Test cancellation by dismissing the browser permission prompt after clicking **Cancel Microphone** if the browser lets you interact with the page while the prompt is open.
