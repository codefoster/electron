const { createDesktopCapturer } = process.electronBinding('desktop_capturer');

const deepEqual = (a: ElectronInternal.GetSourcesOptions, b: ElectronInternal.GetSourcesOptions) => JSON.stringify(a) === JSON.stringify(b);

let currentlyRunning: {
  options: ElectronInternal.GetSourcesOptions;
  getSources: Promise<ElectronInternal.GetSourcesResult[]>;
}[] = [];

export const getSources = (event: Electron.IpcMainEvent, options: ElectronInternal.GetSourcesOptions) => {
  for (const running of currentlyRunning) {
    if (deepEqual(running.options, options)) {
      // If a request is currently running for the same options
      // return that promise
      return running.getSources;
    }
  }

  const getSources = new Promise<ElectronInternal.GetSourcesResult[]>((resolve, reject) => {
    let capturer: ElectronInternal.DesktopCapturer | null = createDesktopCapturer();

    const stopRunning = () => {
      if (capturer) {
        delete capturer._onerror;
        delete capturer._onfinished;
        capturer = null;
      }
      // Remove from currentlyRunning once we resolve or reject
      currentlyRunning = currentlyRunning.filter(running => running.options !== options);
    };

    capturer._onerror = (error: string) => {
      stopRunning();
      reject(error);
    };

    capturer._onfinished = (sources: Electron.DesktopCapturerSource[]) => {
      stopRunning();
      resolve(sources);
    };

    capturer.startHandling(options.captureWindow, options.captureScreen, options.thumbnailSize, options.fetchWindowIcons);

    // If the WebContents is destroyed before receiving result, just remove the
    // reference to emit and the capturer itself so that it never dispatches
    // back to the renderer
    event.sender.once('destroyed', () => stopRunning());
  });

  currentlyRunning.push({
    options,
    getSources
  });

  return getSources;
};