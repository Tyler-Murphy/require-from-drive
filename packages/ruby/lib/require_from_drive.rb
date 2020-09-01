require 'net/http'
require 'json'

class RequireFromDrive
  SERVER_ADDRESS_ENVIRONMENT_VARIABLE_NAME = 'REQUIRE_FROM_DRIVE_SERVER_ADDRESS'
  SERVER_TOKEN_ENVIRONMENT_VARIABLE_NAME = 'REQUIRE_FROM_DRIVE_SERVER_TOKEN'
  SERVER_ADDRESS = ENV[SERVER_ADDRESS_ENVIRONMENT_VARIABLE_NAME]
  SERVER_TOKEN = ENV[SERVER_TOKEN_ENVIRONMENT_VARIABLE_NAME]

  if SERVER_ADDRESS.nil?
    fail "The #{SERVER_ADDRESS_ENVIRONMENT_VARIABLE_NAME} environment variable must be set"
  end

  if SERVER_TOKEN.nil?
    fail "The #{SERVER_TOKEN_ENVIRONMENT_VARIABLE_NAME} environment variable must be set"
  end

  def self.load(path)
    response_string = self.get("#{SERVER_ADDRESS}?token=#{SERVER_TOKEN}&path=#{path}")

    if /^Error: / =~ response_string
      raise response_string
    end

    # In the future, this could `eval` the string if it's not JSON. This would make the behavior more similar to that of the Javascript implementation. But I'm not sure how `eval` works in ruby, and there's no current demand for the feature.
    JSON.parse(response_string)
  end

  private

  def self.get(uri)
    response = Net::HTTP.get_response(URI(uri))

    case response
    when Net::HTTPSuccess then
      response.body
    when Net::HTTPRedirection then
      self.get(response['location'])
    else
      response.value # raise an error if it's not a success
    end
  end
end
