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

  it('toggles both snap modes through the shared snap toggle', () => {
    expect(service.snapEnabled()).toBeFalse();
    expect(service.snapToSeconds()).toBeFalse();
    expect(service.snapToLayers()).toBeFalse();

    service.setSnapEnabled(true);

    expect(service.snapEnabled()).toBeTrue();
    expect(service.snapToSeconds()).toBeTrue();
    expect(service.snapToLayers()).toBeTrue();

    service.setSnapEnabled(false);

    expect(service.snapEnabled()).toBeFalse();
    expect(service.snapToSeconds()).toBeFalse();
    expect(service.snapToLayers()).toBeFalse();
  });

  it('keeps legacy snap setters synchronized', () => {
    service.setSnapToSeconds(true);
    expect(service.snapEnabled()).toBeTrue();
    expect(service.snapToLayers()).toBeTrue();

    service.setSnapToLayers(false);
    expect(service.snapEnabled()).toBeFalse();
    expect(service.snapToSeconds()).toBeFalse();
  });
});

