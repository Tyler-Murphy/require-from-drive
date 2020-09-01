require 'require_from_drive'
require 'minitest/autorun'

class TestRequireFromDrive < MiniTest::Unit::TestCase
  def test_can_load
    response = RequireFromDrive.load('testing/test.json')

    assert_equal(response, { 'hi' => 'there' })
  end

  def test_raises_errors_when_appropriate
    assert_raises { RequireFromDrive.load('testing/fakeFile.json') }
  end
end
