export interface TimeEntry {
  startTime: string;
  endTime?: string;
  projectId: string;
  description: string;
}

export function timeTracker() {
  return {
    isTracking: false,
    isLoading: false,
    startTime: null as Date | null,
    elapsedTime: 0,
    timerInterval: null as number | null,
    message: '',

    init() {
      // Check if there's an active time entry
      this.checkActiveTimeEntry();
    },

    async checkActiveTimeEntry() {
      try {
        const response = await fetch('/time/active');
        if (response.ok) {
          const timeEntry = await response.json() as TimeEntry;
          this.startTime = new Date(timeEntry.startTime);
          this.startTimer();
        }
      } catch (error) {
        console.error('Error checking active time entry:', error);
      }
    },

    formatTime(ms: number): string {
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor(ms / (1000 * 60 * 60));

      return `${hours.toString().padStart(2, '0')}:${
        minutes.toString().padStart(2, '0')}:${
        seconds.toString().padStart(2, '0')}`;
    },

    startTimer() {
      this.isTracking = true;
      if (this.startTime) {
        this.timerInterval = setInterval(() => {
          this.elapsedTime = Date.now() - this.startTime!.getTime();
        }, 1000);
      }
    },

    async startTracking() {
      this.isLoading = true;
      this.message = 'Starting time tracking...';

      try {
        const response = await fetch('/time/start', { method: 'POST' });
        if (response.ok) {
          const timeEntry = await response.json() as TimeEntry;
          this.startTime = new Date(timeEntry.startTime);
          this.startTimer();
          this.message = 'Time tracking started!';
        } else {
          throw new Error('Failed to start time tracking');
        }
      } catch (error) {
        console.error('Error starting time tracking:', error);
        this.message = 'Error starting time tracking';
      } finally {
        this.isLoading = false;
      }
    },

    async stopTracking() {
      this.isLoading = true;
      this.message = 'Stopping time tracking...';

      try {
        const response = await fetch('/time/stop', { method: 'POST' });
        if (response.ok) {
          if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
          }
          this.isTracking = false;
          this.message = 'Time tracking stopped!';
          
          // Dispatch event to refresh summary
          globalThis.dispatchEvent(new CustomEvent('time-entry-updated'));
        } else {
          throw new Error('Failed to stop time tracking');
        }
      } catch (error) {
        console.error('Error stopping time tracking:', error);
        this.message = 'Error stopping time tracking';
      } finally {
        this.isLoading = false;
      }
    }
  };
} 