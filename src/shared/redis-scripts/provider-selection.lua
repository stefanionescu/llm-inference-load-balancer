local profiles = cjson.decode(ARGV[1])
local currentTime = tonumber(ARGV[2])
local windowSize = 60000
local minUsage = 1.1
local selected = nil

local providerKeys = {}
local providerInfo = {}

for provider, providerProfiles in pairs(profiles) do
  for idx, profile in ipairs(providerProfiles) do
    local profIdx = idx - 1
    local base = "provider:" .. provider .. "-" .. profIdx
    table.insert(providerKeys, {
      request = base .. ":requests",
      requestsPerSecond = base .. ":requestsPerSecond",
      pending = base .. ":pending"
    })
    table.insert(providerInfo, {
      provider = provider,
      idx = profIdx,
      quota = profile.quota,
      maxConcurrent = profile.maxConcurrent,
      maxRequestsPerSecond = profile.maxRequestsPerSecond
    })
  end
end

for i, info in ipairs(providerInfo) do
  local keys = providerKeys[i]
  
  redis.call("ZREMRANGEBYSCORE", keys.request, 0, currentTime - windowSize)
  
  local requestCount = tonumber(redis.call("ZCOUNT", keys.request, currentTime - windowSize, currentTime)) or 0
  local pendingCount = tonumber(redis.call("GET", keys.pending)) or 0
  local requestsPerSecond = 0
  
  if info.maxRequestsPerSecond then
    requestsPerSecond = tonumber(redis.call("ZCOUNT", keys.requestsPerSecond, currentTime - 1000, currentTime)) or 0
  end
  
  local usage = requestCount / info.quota
  local canAcceptRequest = true
  
  if info.maxConcurrent then
    canAcceptRequest = pendingCount < info.maxConcurrent
  end
  if info.maxRequestsPerSecond then
    canAcceptRequest = canAcceptRequest and requestsPerSecond < info.maxRequestsPerSecond
  end
  
  if requestCount < info.quota and usage < minUsage and canAcceptRequest then
    minUsage = usage
    selected = {
      provider = info.provider,
      idx = info.idx,
      requestCount = requestCount,
      quota = info.quota,
      pendingCount = pendingCount,
      maxRequestsPerSecond = info.maxRequestsPerSecond,
      requestsPerSecond = requestsPerSecond
    }
  end
end

if not selected then
  return nil
end

local base = "provider:" .. selected.provider .. "-" .. selected.idx
redis.call("ZADD", base .. ":requests", currentTime, currentTime .. ":" .. redis.call("INCR", base .. ":requests:counter"))

if selected.maxRequestsPerSecond then
  redis.call("ZADD", base .. ":requestsPerSecond", currentTime, currentTime)
  redis.call("EXPIRE", base .. ":requestsPerSecond", 2)
end

redis.call("EXPIRE", base .. ":requests", 60)
redis.call("INCR", base .. ":pending")
redis.call("EXPIRE", base .. ":pending", 60)
  
return {
  selected.provider,
  selected.idx,
  selected.requestCount + 1,
  selected.quota,
  selected.pendingCount + 1,
  selected.maxRequestsPerSecond,
  selected.requestsPerSecond
} 