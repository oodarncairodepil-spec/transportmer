# Technical Summary: Integration of HERE Routing API for Truck Routes

## Overview

This document provides guidance on integrating HERE Routing API v8 into an existing application for truck routing. It includes configuration for using:

1. Pure HERE API.
2. Hybrid mode: HERE API + OpenStreetMap (OSM) or Google Maps (GMaps) API.

The goal is to allow switching between routing providers while supporting truck-specific constraints.

***

## 1. API Endpoint

**Base URL:**

```
https://router.hereapi.com/v8/routes
```

**Supported HTTP Methods:**

- `GET` : For query-string based requests.
- `POST` : For large or complex requests including truck-specific parameters and EV/fuel consumption models.

**Security:**

- `ApiKey` (preferred) or `Bearer token` authentication.

***

## 2. Required Parameters

- **transportMode**: `truck` or `networkRestrictedTruck` (for restricted networks).
- **origin**: Start point in `{lat},{lng}` format.
- **destination**: End point in `{lat},{lng}` format.
- **vehicle** (truck-specific): Includes parameters such as:
  - `height`, `width`, `length`
  - `weight`, `axleCount`, `trailerCount`
  - `engineType`, `category` (e.g., hazardous material)
- **departureTime**: Optional, RFC3339 format. Default: current time.

**Notes for Trucks:**

- `networkRestrictedTruck` mode does not allow certain parameters such as `avoid[truckRoadTypes]`, `vehicle[occupancy]` or `ev[*]` parameters【8†source】.

***

## 3. Optional Parameters

- **via**: Intermediate waypoints (supports `passThrough` and `stopDuration`).
- **avoid**: Roads or areas to avoid (`tollRoad`, `truckRoadTypes`, environmental zones).
- **routingMode**: `fast` (default), `short`. Only `fast` supported for `networkRestrictedTruck`.
- **return**: Data returned for each route section (`polyline`, `actions`, `summary`, `truckRoadTypes`, `tolls`).
- **traffic**: Include traffic data.
- **units**: `metric` or `imperial`.
- **lang**: Language preferences for instructions.

***

## 4. Integration Strategy

### 4.1 Modular Architecture

- **RoutingProvider Interface:** Define an interface for route requests:

```
class RoutingProvider:
    def calculate_route(self, origin, destination, vehicle_params, options):
        pass

```

- Implementations:
  - `HEREProvider`: Calls HERE Routing API using REST.
  - `GMapsProvider`: Calls Google Maps Directions API.
  - `OSMProvider`: Uses OSM-based routing (e.g., OSRM or GraphHopper).
- Application can dynamically select provider:

```
if config.routing_api == "HERE":
    provider = HEREProvider(api_key=API_KEY)
elif config.routing_api == "GMaps":
    provider = GMapsProvider(api_key=GAPI_KEY)

```

### 4.2 Truck-Specific Parameters

- Pass all truck dimensions and weight to `vehicle` object in HERE API request.
- For restricted networks:
  - Use `networkRestrictedTruck[permittedNetworks]` parameter.
  - Do **not** include parameters unsupported in this mode.

### 4.3 Switching Providers

- Define a mapping layer that converts unified truck request parameters into provider-specific formats.
- Ensure response normalization:
  - Convert all polyline coordinates to a consistent format (e.g., WGS84).
  - Map route instructions to unified internal representation.
  - Aggregate tolls, travel time, distance.

***

## 5. Response Handling

- **Primary fields for truck routing**:
  - `sections[*].summary.travelTime` : Estimated duration.
  - `sections[*].summary.length` : Distance.
  - `sections[*].tolls` : Toll information per section.
  - `sections[*].truckRoadTypes` : Road type restrictions.
  - `polyline` : Route geometry for map rendering.
- Store `routeHandle` for caching and partial reroutes.

***

## 6. Error Handling

- `400`: Invalid parameters.
- `401`: Unauthorized.
- `403`: Forbidden region (e.g., Japan for truck routing without permission).
- `500`: Server error.

**Tip:** Always validate truck dimensions, weight, and routingMode before request.

***

## 7. Best Practices

- Cache routes using `routeHandle` for repeated queries.
- Respect API limits for large truck fleets.
- Include fallback logic:
  - If HERE API fails, fallback to GMaps or OSM.
- Include time-dependent traffic for accurate ETA.
- Modularize vehicle profiles for easy switching between truck, EV, or hybrid trucks.

***

## References

- HERE Routing API v8: [Documentation](https://www.here.com/docs/bundle/routing-api-developer-guide-v8/page/concepts/truck-routing.html)【8†source】.
- Flexible Polyline Encoding: [GitHub](https://github.com/heremaps/flexible-polyline)

  <br />

### Key points:

&#x20;

1. **Truck-Specific Vehicle Parameters**
   - When requesting a truck route, you provide the `vehicle` object with parameters like:
     - `height`, `width`, `length`
     - `weight`, `axleCount`, `trailerCount`
     - `engineType`, `category` (hazardous, perishable, etc.)
   - The routing engine uses these to filter out road segments that are unsafe or illegal for the truck.
2. **Truck Road Attributes (from HERE Data)**
   - `truckRoadTypes`: classifies the road segment type relevant to trucks (e.g., BK1, BK2, BK3, BK4).
   - `tolls`: toll information, often truck-specific.
   - `avoid[truckRoadTypes]` and `avoid[features]`: you can explicitly avoid roads unsuitable for your truck.
   - Maximum weight, height, width, and length restrictions are encoded in the road network. The engine automatically avoids roads violating your truck profile.
3. **Route Safety Decisions**
   - HERE does **not return the raw tags like “maxHeight=4m” or “lanes=2”** as OSM does. Instead:
     - It **encodes these restrictions internally** and filters them out during route calculation.
     - The API provides **high-level metadata** per route section, such as `truckRoadTypes`, and you can see whether a segment is safe for the given vehicle.
     - If a segment violates the truck parameters, it will be avoided automatically or included with a warning if no alternative exists.
4. **Practical Use**
   - You can **query** **`sections[*].truckRoadTypes`** **and** **`sections[*].tolls`** for each segment to see how the route was selected.
   - You can **adjust** **`vehicle`** **parameters** or `avoid` rules to further customize routing (e.g., exclude narrow roads or weight-limited bridges).
   - For explicit inspection like OSM tags, you would need to cross-reference with raw map data or use a hybrid approach (HERE API for routing, OSM for verification).

