local profiles = cjson.decode(ARGV[1])
local currentTime = tonumber(ARGV[2])
local windowSize = 60000
local minUsage = math.huge
local selected = nil

-- Store profile info in order for reliable indexing
local orderedProfiles = {}
local keys = {}

-- Create ordered arrays and validate profiles
for provider, providerProfiles in pairs(profiles) do
  if type(providerProfiles) == "table" then
    for profileIdx, quota in ipairs(providerProfiles) do
      if type(quota) == "number" and quota > 0 then
        table.insert(orderedProfiles, {
          provider = provider,
          profileIdx = profileIdx - 1,
          quota = quota
        })
        table.insert(keys, "provider:" .. provider .. "-" .. (profileIdx - 1) .. ":requests")
      end
    end
  end
end

-- Process each provider sequentially
for i, profile in ipairs(orderedProfiles) do
  local key = keys[i]
  
  -- Clean up old requests
  redis.call("ZREMRANGEBYSCORE", key, 0, currentTime - windowSize)
  
  -- Get current count with error handling
  local requestCount = tonumber(redis.call("ZCOUNT", key, currentTime - windowSize, currentTime)) or 0
  local usage = requestCount / profile.quota
  
  if requestCount < profile.quota and usage < minUsage then
    minUsage = usage
    selected = {
      provider = profile.provider,
      profileIdx = profile.profileIdx,
      requestCount = requestCount,
      quota = profile.quota
    }
  end
end

if selected then
  local key = "provider:" .. selected.provider .. "-" .. selected.profileIdx .. ":requests"
  local uniqueId = currentTime .. ":" .. redis.call("INCR", key .. ":counter")
  redis.call("ZADD", key, currentTime, uniqueId)
  redis.call("EXPIRE", key, 70) -- Set TTL slightly longer than window
  
  return {selected.provider, selected.profileIdx, selected.requestCount + 1, selected.quota}
end

return nil 