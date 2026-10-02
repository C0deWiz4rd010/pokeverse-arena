import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../cache/cache.service';
import { PokeApiClient } from './pokeapi.client';

describe('PokeApiClient', () => {
  const store = new Map<string, unknown>();
  const http = { get: vi.fn() };

  beforeEach(() => {
    store.clear();
    http.get.mockReset();
    vi.spyOn(Math, 'random').mockReturnValue(0); // zero backoff delay
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: http },
        {
          provide: CacheService,
          useValue: {
            get: async (k: string) => store.get(k),
            set: async (k: string, v: unknown) => void store.set(k, v),
          },
        },
      ],
    });
  });

  const err = (status: number) => throwError(() => new HttpErrorResponse({ status }));

  it('retries transient failures and then succeeds', async () => {
    http.get.mockReturnValueOnce(err(503)).mockReturnValueOnce(err(0)).mockReturnValueOnce(of({ ok: 1 }));
    const data = await TestBed.inject(PokeApiClient).get<{ ok: number }>('https://x/a');
    expect(data).toEqual({ ok: 1 });
    expect(http.get).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 404', async () => {
    http.get.mockReturnValue(err(404));
    await expect(TestBed.inject(PokeApiClient).get('https://x/missing')).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget', async () => {
    http.get.mockReturnValue(err(500));
    await expect(TestBed.inject(PokeApiClient).get('https://x/down')).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(http.get).toHaveBeenCalledTimes(3);
  });

  it('de-duplicates concurrent requests and serves repeats from cache', async () => {
    http.get.mockReturnValue(of({ n: 1 }));
    const c = TestBed.inject(PokeApiClient);
    const [a, b] = await Promise.all([c.get('https://x/d'), c.get('https://x/d')]);
    expect(a).toBe(b);
    await c.get('https://x/d');
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
