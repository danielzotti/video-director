import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MathService {


  public greatestCommonDivisor(a: number, b: number): number {
    if (b === 0) {
      return a;
    }
    return this.greatestCommonDivisor(b, a % b);
  }

  public minimumCommonMultiple(a: number, b: number): number {
    return (a * b) / this.greatestCommonDivisor(a, b);
  }

  public divisors(num: number): number[] {
    return [...Array(num)]
      .map((x, i) => i)
      .filter(x => num % x === 0).slice(1)
  }

  public divisorsInCommon(a: number, b: number): number[] {
    return this.divisors(a).filter(x => this.divisors(b).includes(x));
  }
}
