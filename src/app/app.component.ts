import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { BehaviorSubject, filter, map, Observable, switchMap, takeUntil, takeWhile } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TimerService } from './timer.service';
import { format } from 'date-fns';

type State = 'Stopped' | 'Started' | 'StartedOvertime';
interface History {
  event: 'Start' | 'Drink' | 'Stop';
  time: Date;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, FormsModule],
  standalone: true,
})
export class AppComponent {
  reminderFrequencyInMinutes = 60;
  state$ = new BehaviorSubject<State>('Stopped');
  startedCountdown$: Observable<number>;
  startedCountdownFormatted$: Observable<string>;
  overtimeCountdown$: Observable<number>;
  histories: History[] = [];
  currentNotification?: Notification;

  constructor(timerService: TimerService) {
    this.startedCountdown$ = this.state$
      .pipe(
        filter(x => x === 'Started'),
        switchMap(() => timerService.timer().pipe(
          map(x => this.reminderFrequencyInMinutes * 60 - x),
          takeWhile(x => x >= 0),
          takeUntil(this.state$.pipe(filter(x => x !== 'Started'))),
        )),
    );

    this.startedCountdownFormatted$ = this.startedCountdown$.pipe(map(x => {
        const min = `${Math.floor(x / 60)}`.padStart(2, '0');
        const sec = `${Math.floor(x % 60)}`.padStart(2, '0');
        return `${min}:${sec}`;
    }));

    this.overtimeCountdown$ = this.state$.pipe(
      filter(x => x === 'StartedOvertime'),
      switchMap(() => timerService.timer().pipe(
        map(x => 59 - (x % 60)),
        takeUntil(this.state$.pipe(filter(x => x !== 'StartedOvertime'))),
      )),
    );

    this.startedCountdown$.pipe(filter(x => x === 0)).subscribe(() => {
      this.sendNotification(`[${format(new Date(), 'HH:mm aa')}] Time to drink some water`);
      this.state$.next('StartedOvertime');
    });

    this.overtimeCountdown$.pipe(filter(x => x === 0)).subscribe(() => {
      this.sendNotification(`[${format(new Date(), 'HH:mm aa')}] Time to drink some water`);
    });
  }

  hasNotificationPermission(): boolean {
    return window.Notification.permission === 'granted';
  }

  start() {
    this.histories.push({
      event: 'Start',
      time: new Date(),
    });
    this.state$.next('Started');
  }

  stop() {
    this.histories.push({
      event: 'Stop',
      time: new Date(),
    });
    this.state$.next('Stopped');
  }

  drink() {
    this.histories.push({
      event: 'Drink',
      time: new Date(),
    });
    this.state$.next('Started');
  }

  async requestNotificationPermission() {
    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      this.sendNotification('We are good to go~');
    }
  }

  async sendNotification(msg: string) {
    if (window.Notification.permission === 'granted') {
      this.currentNotification?.close();
      this.currentNotification = new Notification('Water reminder', {
        body: msg,
      });
    }
  }
}
