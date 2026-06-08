import { TestBed } from '@angular/core/testing';
import { TimelineService } from './timeline.service';

describe('TimelineService', () => {
  let service: TimelineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimelineService);
  });

  it('defaults showAllWidgets to false', () => {
    expect(service.showAllWidgets()).toBeFalse();
  });

  it('updates showAllWidgets through setter', () => {
    service.setShowAllWidgets(true);
    expect(service.showAllWidgets()).toBeTrue();

    service.setShowAllWidgets(false);
    expect(service.showAllWidgets()).toBeFalse();
  });
});

