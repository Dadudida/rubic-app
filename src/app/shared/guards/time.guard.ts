import { Inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate } from '@angular/router';
import { WINDOW } from '@ng-web-apis/common';
import { RubicWindow } from '@shared/utils/rubic-window';
import { catchError, map, Observable, of } from 'rxjs';
import { HttpService } from '@core/services/http/http.service';

@Injectable()
export class TimeGuard implements CanActivate {
  constructor(
    @Inject(WINDOW) private readonly window: RubicWindow,
    private readonly httpService: HttpService
  ) {}

  public canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const { redirectPath, expiredDateInSeconds, expiredDateInMilliseconds } = route.data;
    const currentDate = Date.now();

    return this.httpService.get<{ current_timestamp: number }>('current_timestamp').pipe(
      map(response => {
        if (response.current_timestamp < expiredDateInSeconds) {
          this.window.location.href = redirectPath;
          return false;
        } else {
          return true;
        }
      }),
      catchError(() => {
        if (currentDate < expiredDateInMilliseconds) {
          this.window.location.href = redirectPath;
          return of(false);
        } else {
          return of(true);
        }
      })
    );
  }
}
