-- Taiwan ordinary-scooter profile, derived from car.lua in
-- osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409
-- (git dca35dcc8676df6fa93f491a7b157136918173d5).
--
-- There is no official OSRM motorcycle profile. This is not 大型重機:
--   * highway=motorway and motorway_link are closed (國道), even if motorcycle=yes.
--   * motorroad=yes and expressway=yes are closed unless moped or motorcycle
--     is yes / designated / permissive.
--   * trunk/trunk_link whose ref is 61, 62, 64–68, 72–78, or 82–88 (西濱 and
--     東西向快速公路) is closed the same way. primary ref=61 stays open.
--   * moped=no blocks the way even when motorcycle=yes.
--   * motorcycle=no, motor_vehicle=no and access=no are honored via the access hierarchy.
--   * motorcar=* is not consulted, so motorcar=no alleys stay open.
--   * oneway:moped and oneway:motorcycle are honored by the restrictions list.
--   * motorcycle:conditional (displacement) is not evaluated.
--   * 兩段式左轉 is a time penalty on large-road left turns, not a hook geometry.
--
-- The routed service still uses the URL profile name "driving"; the graph is motorcycle.

-- Car profile

api_version = 4

Set = require('lib/set')
Sequence = require('lib/sequence')
Handlers = require("lib/way_handlers")
Relations = require("lib/relations")
find_access_tag = require("lib/access").find_access_tag
limit = require("lib/maxspeed").limit
Utils = require("lib/utils")
Measure = require("lib/measure")

function setup()
  return {
    properties = {
      max_speed_for_map_matching      = 180/3.6, -- 180kmph -> m/s
      -- For routing based on duration, but weighted for preferring certain roads
      weight_name                     = 'routability',
      -- For shortest duration without penalties for accessibility
      -- weight_name                     = 'duration',
      -- For shortest distance without penalties for accessibility
      -- weight_name                     = 'distance',
      process_call_tagless_node      = false,
      u_turn_penalty                 = 20,
      continue_straight_at_waypoint  = true,
      use_turn_restrictions          = true,
      left_hand_driving              = false,
      traffic_light_penalty          = 2,
    },

    default_mode              = mode.driving,
    default_speed             = 25,
    oneway_handling           = true,
    side_road_multiplier      = 0.9,
    turn_penalty              = 7.5,
    speed_reduction           = 0.8,
    turn_bias                 = 1.075,
    cardinal_directions       = false,

    -- Size of the vehicle, to be limited by physical restriction of the way
    -- Ordinary scooter, not a car. Narrow alleys stay under the width gate.
    vehicle_height = 1.5,
    vehicle_width = 0.9,
    vehicle_length = 2.2,
    vehicle_weight = 300,

    -- a list of suffixes to suppress in name change instructions. The suffixes also include common substrings of each other
    suffix_list = {
      'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'North', 'South', 'West', 'East', 'Nor', 'Sou', 'We', 'Ea'
    },

    barrier_whitelist = Set {
      'cattle_grid',
      'border_control',
      'toll_booth',
      'sally_port',
      'gate',
      'lift_gate',
      'no',
      'entrance',
      'height_restrictor',
      'arch'
    },

    access_tag_whitelist = Set {
      'yes',
      'motorcycle',
      'moped',
      'motor_vehicle',
      'vehicle',
      'permissive',
      'designated',
      'hov'
    },

    access_tag_blacklist = Set {
      'no',
      'agricultural',
      'forestry',
      'emergency',
      'psv',
      'customers',
      'private',
      'delivery',
      'destination'
    },

    -- tags disallow access to in combination with highway=service
    service_access_tag_blacklist = Set {
        'private'
    },

    restricted_access_tag_list = Set {
      'private',
      'delivery',
      'destination',
      'customers',
    },

    -- moped before motorcycle so moped=no (大型重機 only) blocks scooters
    -- even when motorcycle=yes. motorcar is intentionally absent: a way with
    -- motorcar=no and no motorcycle ban stays open to scooters (巷弄).
    access_tags_hierarchy = Sequence {
      'moped',
      'motorcycle',
      'motor_vehicle',
      'vehicle',
      'access'
    },

    service_tag_forbidden = Set {
      'emergency_access'
    },

    -- oneway:moped / oneway:motorcycle are consulted before oneway.
    restrictions = Sequence {
      'moped',
      'motorcycle',
      'motor_vehicle',
      'vehicle'
    },

    classes = Sequence {
        'toll', 'motorway', 'ferry', 'restricted', 'tunnel'
    },

    -- classes to support for exclude flags
    excludable = Sequence {
        Set {'toll'},
        Set {'motorway'},
        Set {'ferry'}
    },

    avoid = Set {
      'area',
      -- 'toll',    -- uncomment this to avoid tolls
      'reversible',
      'impassable',
      'hov_lanes',
      'steps',
      'construction',
      'proposed'
    },

    speeds = Sequence {
      highway = {
        motorway        = 70,
        motorway_link   = 40,
        trunk           = 70,
        trunk_link      = 40,
        primary         = 60,
        primary_link    = 35,
        secondary       = 50,
        secondary_link  = 30,
        tertiary        = 40,
        tertiary_link   = 25,
        unclassified    = 30,
        residential     = 30,
        living_street   = 15,
        service         = 25
      }
    },

    service_penalties = {
      alley             = 0.95,
      parking           = 0.5,
      parking_aisle     = 0.5,
      driveway          = 0.5,
      ["drive-through"] = 0.5,
      ["drive-thru"] = 0.5
    },

    restricted_highway_whitelist = Set {
      'motorway',
      'motorway_link',
      'trunk',
      'trunk_link',
      'primary',
      'primary_link',
      'secondary',
      'secondary_link',
      'tertiary',
      'tertiary_link',
      'residential',
      'living_street',
      'unclassified',
      'service'
    },

    construction_whitelist = Set {
      'no',
      'widening',
      'minor',
    },

    route_speeds = {
      ferry = 5,
      shuttle_train = 10
    },

    bridge_speeds = {
      movable = 5
    },

    -- surface/trackype/smoothness
    -- values were estimated from looking at the photos at the relevant wiki pages

    -- max speed for surfaces
    surface_speeds = {
      asphalt = nil,    -- nil mean no limit. removing the line has the same effect
      concrete = nil,
      ["concrete:plates"] = nil,
      ["concrete:lanes"] = nil,
      paved = nil,

      cement = 80,
      compacted = 80,
      fine_gravel = 80,

      paving_stones = 60,
      metal = 60,
      bricks = 60,

      grass = 40,
      wood = 40,
      sett = 40,
      grass_paver = 40,
      gravel = 40,
      unpaved = 40,
      ground = 40,
      dirt = 40,
      pebblestone = 40,
      tartan = 40,

      cobblestone = 30,
      clay = 30,

      earth = 20,
      stone = 20,
      rocky = 20,
      sand = 20,

      mud = 10
    },

    -- max speed for tracktypes
    tracktype_speeds = {
      grade1 =  60,
      grade2 =  40,
      grade3 =  30,
      grade4 =  25,
      grade5 =  20
    },

    -- max speed for smoothnesses
    smoothness_speeds = {
      intermediate    =  80,
      bad             =  40,
      very_bad        =  20,
      horrible        =  10,
      very_horrible   =  5,
      impassable      =  0
    },

    -- http://wiki.openstreetmap.org/wiki/Speed_limits
    maxspeed_table_default = {
      urban = 50,
      rural = 90,
      trunk = 110,
      motorway = 130
    },

    -- List only exceptions
    maxspeed_table = {
      ["at:rural"] = 100,
      ["at:trunk"] = 100,
      ["be:motorway"] = 120,
      ["be-bru:rural"] = 70,
      ["be-bru:urban"] = 30,
      ["be-vlg:rural"] = 70,
      ["by:urban"] = 60,
      ["by:motorway"] = 110,
      ["ch:rural"] = 80,
      ["ch:trunk"] = 100,
      ["ch:motorway"] = 120,
      ["cz:trunk"] = 0,
      ["cz:motorway"] = 0,
      ["de:living_street"] = 7,
      ["de:rural"] = 100,
      ["de:motorway"] = 0,
      ["dk:rural"] = 80,
      ["fr:rural"] = 80,
      ["gb:nsl_single"] = (60*1609)/1000,
      ["gb:nsl_dual"] = (70*1609)/1000,
      ["gb:motorway"] = (70*1609)/1000,
      ["nl:rural"] = 80,
      ["nl:trunk"] = 100,
      ['no:rural'] = 80,
      ['no:motorway'] = 110,
      ['pl:rural'] = 100,
      ['pl:trunk'] = 120,
      ['pl:motorway'] = 140,
      ["ro:trunk"] = 100,
      ["ru:living_street"] = 20,
      ["ru:urban"] = 60,
      ["ru:motorway"] = 110,
      ["uk:nsl_single"] = (60*1609)/1000,
      ["uk:nsl_dual"] = (70*1609)/1000,
      ["uk:motorway"] = (70*1609)/1000,
      ['za:urban'] = 60,
      ['za:rural'] = 100,
      ["tw:urban"] = 50,
      ["tw:rural"] = 70,
      ["tw:trunk"] = 80,
      ["tw:motorway"] = 80,
      ["none"] = 140
    },

    relation_types = Sequence {
      "route"
    },

    -- classify highway tags when necessary for turn weights
    -- Used only to recognize large roads in process_turn. Values must be < 16.
    -- Links are omitted: a ramp is not where 兩段式左轉 is signed.
    highway_turn_classification = {
      motorway = 15,
      trunk = 14,
      primary = 13,
    },

    -- classify access tags when necessary for turn weights
    access_turn_classification = {
    }
  }
end

function process_node(profile, node, result, relations)
  -- parse access and barrier tags
  local access = find_access_tag(node, profile.access_tags_hierarchy)
  if access then
    if profile.access_tag_blacklist[access] and not profile.restricted_access_tag_list[access] then
      result.barrier = true
    end
  else
    local barrier = node:get_value_by_key("barrier")
    if barrier then
      --  check height restriction barriers
      local restricted_by_height = false
      if barrier == 'height_restrictor' then
         local maxheight = Measure.get_max_height(node:get_value_by_key("maxheight"), node)
         restricted_by_height = maxheight and maxheight < profile.vehicle_height
      end

      --  make an exception for rising bollard barriers
      local bollard = node:get_value_by_key("bollard")
      local rising_bollard = bollard and "rising" == bollard

      -- make an exception for lowered/flat barrier=kerb
      -- and incorrect tagging of highway crossing kerb as highway barrier
      local kerb = node:get_value_by_key("kerb")
      local highway = node:get_value_by_key("highway")
      local flat_kerb = kerb and ("lowered" == kerb or "flush" == kerb)
      local highway_crossing_kerb = barrier == "kerb" and highway and highway == "crossing"

      if not profile.barrier_whitelist[barrier]
                and not rising_bollard
                and not flat_kerb
                and not highway_crossing_kerb
                or restricted_by_height then
        result.barrier = true
      end
    end
  end

  -- check if node is a traffic light
  local tag = node:get_value_by_key("highway")
  if "traffic_signals" == tag then
    result.traffic_lights = true
  end
end

-- Taiwan scooter rules applied after the car handlers.
-- Ordinary scooters (not 大型重機). motorcycle:conditional is not evaluated:
-- OSRM cannot test engine displacement, so "yes @ (displacement>=550)" does not
-- open a road. 兩段式左轉 is not geometric; see process_turn.

local SCOOTER_MAX_KMH = 80

local function direction_routable(result, which)
  local m, s
  if which == "forward" then
    m = result.forward_mode
    s = result.forward_speed
  else
    m = result.backward_mode
    s = result.backward_speed
  end
  return m ~= mode.inaccessible and s ~= nil and s > 0
end

local function any_routable(result)
  return direction_routable(result, "forward") or direction_routable(result, "backward")
end

local function deny(result)
  result.forward_mode = mode.inaccessible
  result.backward_mode = mode.inaccessible
  result.forward_speed = 0
  result.backward_speed = 0
  result.forward_rate = 0
  result.backward_rate = 0
end

local function tag_allows_scooter(way, key)
  local value = way:get_value_by_key(key)
  return value == "yes" or value == "designated" or value == "permissive"
end

-- 東西向快速公路 and 西部濱海快速公路. Not 省道台1/台3.
local expressway_refs = Set {
  "61", "61甲", "62", "64", "65", "66", "68",
  "72", "74", "76", "78", "82", "84", "86", "88"
}

local function ref_is_expressway(way)
  local ref = way:get_value_by_key("ref")
  if not ref then
    return false
  end
  for part in ref:gmatch("[^;]+") do
    local token = part:gsub("^%s+", ""):gsub("%s+$", "")
    if expressway_refs[token] then
      return true
    end
  end
  return false
end

local function apply_taiwan_scooter_rules(profile, way, result)
  if not any_routable(result) then
    return
  end

  local highway = way:get_value_by_key("highway")
  -- 國道. Almost none of these ways carry motorcycle=no (see tag coverage),
  -- so the legal ban cannot depend on the tag. motorcycle=yes does not reopen them.
  if highway == "motorway" or highway == "motorway_link" then
    deny(result)
    return
  end

  -- 快速道路 are not a highway=* value. In this extract they show up as
  -- motorroad=yes (mostly trunk), rarely expressway=yes, or as trunk ways
  -- whose ref is a 快速公路 number (台61 西濱, 台64/78, …) with no motorroad
  -- tag. Plain trunk without those signals stays usable (省道, including 台1).
  -- primary+ref=61 is left open: that is often the parallel coastal road.
  -- Explicit moped/motorcycle=yes|designated opens a way.
  local motorroad = way:get_value_by_key("motorroad")
  local expressway = way:get_value_by_key("expressway")
  local ref_express = (highway == "trunk" or highway == "trunk_link") and ref_is_expressway(way)
  if (motorroad == "yes" or expressway == "yes" or ref_express)
      and not tag_allows_scooter(way, "moped")
      and not tag_allows_scooter(way, "motorcycle") then
    deny(result)
    return
  end

  if result.forward_mode == mode.driving and result.forward_speed and result.forward_speed > SCOOTER_MAX_KMH then
    result.forward_speed = SCOOTER_MAX_KMH
  end
  if result.backward_mode == mode.driving and result.backward_speed and result.backward_speed > SCOOTER_MAX_KMH then
    result.backward_speed = SCOOTER_MAX_KMH
  end

  -- WayHandlers.penalties halves routability for width<=3m or a single
  -- bidirectional lane. That is normal scooter territory in Taiwan, so
  -- recompute the rate without that penalty. Service and side-road multipliers stay.
  if profile.properties.weight_name ~= "routability" then
    return
  end
  local service = way:get_value_by_key("service")
  local service_penalty = (service and profile.service_penalties[service]) or 1.0
  local side = way:get_value_by_key("side_road")
  local side_penalty = (side == "yes" or side == "rotary") and profile.side_road_multiplier or 1.0
  local alternating = way:get_value_by_key("oneway") == "alternating" and 0.4 or 1.0
  local penalty = math.min(service_penalty, side_penalty, alternating)
  if result.forward_mode ~= mode.inaccessible and result.forward_speed and result.forward_speed > 0 then
    result.forward_rate = (result.forward_speed * penalty) / 3.6
  end
  if result.backward_mode ~= mode.inaccessible and result.backward_speed and result.backward_speed > 0 then
    result.backward_rate = (result.backward_speed * penalty) / 3.6
  end
end

function process_way(profile, way, result, relations)
  -- the intial filtering of ways based on presence of tags
  -- affects processing times significantly, because all ways
  -- have to be checked.
  -- to increase performance, prefetching and intial tag check
  -- is done in directly instead of via a handler.

  -- in general we should  try to abort as soon as
  -- possible if the way is not routable, to avoid doing
  -- unnecessary work. this implies we should check things that
  -- commonly forbids access early, and handle edge cases later.

  -- data table for storing intermediate values during processing
  local data = {
    -- prefetch tags
    highway = way:get_value_by_key('highway'),
    bridge = way:get_value_by_key('bridge'),
    route = way:get_value_by_key('route')
  }

  -- perform an quick initial check and abort if the way is
  -- obviously not routable.
  -- highway or route tags must be in data table, bridge is optional
  if (not data.highway or data.highway == '') and
  (not data.route or data.route == '')
  then
    return
  end

  handlers = Sequence {
    -- set the default mode for this profile. if can be changed later
    -- in case it turns we're e.g. on a ferry
    WayHandlers.default_mode,

    -- check various tags that could indicate that the way is not
    -- routable. this includes things like status=impassable,
    -- toll=yes and oneway=reversible
    WayHandlers.blocked_ways,
    WayHandlers.avoid_ways,
    WayHandlers.handle_height,
    WayHandlers.handle_width,
    WayHandlers.handle_length,
    WayHandlers.handle_weight,

    -- determine access status by checking our hierarchy of
    -- access tags, e.g: motorcar, motor_vehicle, vehicle
    WayHandlers.access,

    -- check whether forward/backward directions are routable
    WayHandlers.oneway,

    -- check a road's destination
    WayHandlers.destinations,

    -- check whether we're using a special transport mode
    WayHandlers.ferries,
    WayHandlers.movables,

    -- handle service road restrictions
    WayHandlers.service,

    -- handle hov
    WayHandlers.hov,

    -- compute speed taking into account way type, maxspeed tags, etc.
    WayHandlers.speed,
    WayHandlers.maxspeed,
    WayHandlers.surface,
    WayHandlers.penalties,

    -- compute class labels
    WayHandlers.classes,

    -- handle turn lanes and road classification, used for guidance
    WayHandlers.turn_lanes,
    WayHandlers.classification,

    -- handle various other flags
    WayHandlers.roundabouts,
    WayHandlers.startpoint,
    WayHandlers.driving_side,

    -- set name, ref and pronunciation
    WayHandlers.names,

    -- set weight properties of the way
    WayHandlers.weights,

    -- set classification of ways relevant for turns
    WayHandlers.way_classification_for_turn
  }

  WayHandlers.run(profile, way, result, data, handlers, relations)

  if profile.cardinal_directions then
      Relations.process_way_refs(way, relations, result)
  end

  apply_taiwan_scooter_rules(profile, way, result)
end

function process_turn(profile, turn)
  -- Use a sigmoid function to return a penalty that maxes out at turn_penalty
  -- over the space of 0-180 degrees.  Values here were chosen by fitting
  -- the function to some turn penalty samples from real driving.
  local turn_penalty = profile.turn_penalty
  local turn_bias = turn.is_left_hand_driving and 1. / profile.turn_bias or profile.turn_bias

  if turn.has_traffic_light then
      turn.duration = profile.properties.traffic_light_penalty
  end

  if turn.number_of_roads > 2 or turn.source_mode ~= turn.target_mode or turn.is_u_turn then
    if turn.angle >= 0 then
      turn.duration = turn.duration + turn_penalty / (1 + math.exp( -((13 / turn_bias) *  turn.angle/180 - 6.5*turn_bias)))
    else
      turn.duration = turn.duration + turn_penalty / (1 + math.exp( -((13 * turn_bias) * -turn.angle/180 - 6.5/turn_bias)))
    end

    if turn.is_u_turn then
      turn.duration = turn.duration + profile.properties.u_turn_penalty
    end
  end

  -- 兩段式左轉 cannot be inserted as a two-stage geometry. On large roads
  -- (primary and above, or 3+ lanes) a left turn only costs extra time.
  -- turn.angle < 0 is a left turn in right-hand traffic (same sign the car
  -- sigmoid already penalizes more heavily).
  if (not turn.is_u_turn) and turn.angle < -30 and turn.angle > -150 then
    local class = turn.source_highway_turn_classification or 0
    local lanes = turn.source_number_of_lanes or 0
    if class >= 13 or lanes >= 3 then
      turn.duration = turn.duration + 20
    end
  end

  -- for distance based routing we don't want to have penalties based on turn angle
  if profile.properties.weight_name == 'distance' then
     turn.weight = 0
  else
     turn.weight = turn.duration
  end

  if profile.properties.weight_name == 'routability' then
      -- penalize turns from non-local access only segments onto local access only tags
      if not turn.source_restricted and turn.target_restricted then
          turn.weight = constants.max_turn_weight
      end
  end
end

return {
  setup = setup,
  process_way = process_way,
  process_node = process_node,
  process_turn = process_turn
}
