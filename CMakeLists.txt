cmake_minimum_required(VERSION 3.21)
project(AmicoSdk VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(AMICO_BUILD_TESTS "Build offline unit tests and the gated live smoke test" ON)
option(AMICO_BUILD_EXAMPLES "Build the per-operation example binaries" ON)

option(AMICO_BUILD_BACKEND "Build the amico_backend HTTP API server and its tests" ON)

find_package(CURL REQUIRED)
find_package(nlohmann_json REQUIRED)

add_library(amico_sdk STATIC
    src/Session.cpp
    src/JsonRedact.cpp
    src/UrlValidation.cpp
    src/ObjectQuery.cpp
    src/Client.cpp
    src/NetworkSafety.cpp
    src/http/CurlTransport.cpp
)
add_library(Amico::Sdk ALIAS amico_sdk)

target_include_directories(amico_sdk
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(amico_sdk
    PUBLIC
        nlohmann_json::nlohmann_json
    PRIVATE
        CURL::libcurl
)

if(MSVC)
    target_compile_options(amico_sdk PRIVATE /W4)
else()
    target_compile_options(amico_sdk PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(AMICO_BUILD_TESTS)
    enable_testing()
    find_package(doctest CONFIG REQUIRED)

    add_executable(amico_tests
        test/main.cpp
        test/test_auth.cpp
        test/test_session.cpp
        test/test_system_information.cpp
        test/test_network_safety.cpp
        test/test_users.cpp
        test/test_users_profile.cpp
        test/test_visitors.cpp
        test/test_visits.cpp
        test/test_groups.cpp
        test/test_timezones.cpp
        test/test_holidays.cpp
        test/test_scheduled_unlocks.cpp
        test/test_user_types.cpp
        test/test_custom_fields.cpp
        test/test_reports.cpp
        test/test_relay_actions.cpp
        test/test_internal_alarms.cpp
        test/test_access_logs.cpp
        test/test_redaction.cpp
        test/test_query_whitelist.cpp
        test/test_errors.cpp
        test/test_fixtures_load.cpp
    )
    target_link_libraries(amico_tests PRIVATE amico_sdk doctest::doctest)
    target_include_directories(amico_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_compile_definitions(amico_tests PRIVATE
        AMICO_TEST_FIXTURES_DIR="${CMAKE_CURRENT_SOURCE_DIR}/test/fixtures"
    )

    include(CTest)
    add_test(NAME amico_offline_tests COMMAND amico_tests)

    add_executable(amico_live_smoke_test test/live/live_smoke_test.cpp)
    target_link_libraries(amico_live_smoke_test PRIVATE amico_sdk)
    target_include_directories(amico_live_smoke_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

    add_executable(amico_live_write_test test/live/live_write_test.cpp)
    target_link_libraries(amico_live_write_test PRIVATE amico_sdk)

    add_executable(amico_live_write_profile_test test/live/live_write_profile_test.cpp)
    target_link_libraries(amico_live_write_profile_test PRIVATE amico_sdk)
    if(MSVC)
        # This file's sample-image path is a UTF-8-encoded, non-ASCII
        # (Vietnamese) string literal -- force MSVC to treat both the
        # source file and the narrow-string execution charset as UTF-8,
        # so the compiled literal's bytes match what
        # utf8PathToWide()/MultiByteToWideChar(CP_UTF8, ...) expects.
        target_compile_options(amico_live_write_profile_test PRIVATE /utf-8)
    endif()

    add_executable(amico_live_admin_test test/live/live_admin_test.cpp)
    target_link_libraries(amico_live_admin_test PRIVATE amico_sdk)

    add_executable(amico_live_password_test test/live/live_password_test.cpp)
    target_link_libraries(amico_live_password_test PRIVATE amico_sdk)
endif()

if(AMICO_BUILD_BACKEND)
    find_package(httplib CONFIG REQUIRED)

    add_library(amico_backend_lib STATIC
        backend/SessionStore.cpp
        backend/Routes.cpp
        backend/JsonMapping.cpp
        backend/ErrorMapping.cpp
    )
    target_include_directories(amico_backend_lib PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/backend)
    target_link_libraries(amico_backend_lib PUBLIC amico_sdk httplib::httplib)

    add_executable(amico_backend backend/main.cpp)
    target_link_libraries(amico_backend PRIVATE amico_backend_lib)

    if(AMICO_BUILD_TESTS)
        add_executable(amico_backend_tests
            test/backend/test_routes.cpp
        )
        target_link_libraries(amico_backend_tests PRIVATE amico_backend_lib doctest::doctest)
        target_include_directories(amico_backend_tests PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}/src
            ${CMAKE_CURRENT_SOURCE_DIR}/test
        )
        target_compile_definitions(amico_backend_tests PRIVATE
            AMICO_TEST_FIXTURES_DIR="${CMAKE_CURRENT_SOURCE_DIR}/test/fixtures"
        )
        add_test(NAME amico_backend_offline_tests COMMAND amico_backend_tests)

        add_executable(amico_backend_live_smoke_test test/backend/live_backend_smoke_test.cpp)
        target_link_libraries(amico_backend_live_smoke_test PRIVATE amico_backend_lib)
    endif()
endif()

if(AMICO_BUILD_EXAMPLES)
    add_executable(amico_example_login examples/login_example.cpp)
    target_link_libraries(amico_example_login PRIVATE amico_sdk)

    add_executable(amico_example_session_check examples/session_check_example.cpp)
    target_link_libraries(amico_example_session_check PRIVATE amico_sdk)

    add_executable(amico_example_system_information examples/system_information_example.cpp)
    target_link_libraries(amico_example_system_information PRIVATE amico_sdk)

    add_executable(amico_example_list_users examples/list_users_example.cpp)
    target_link_libraries(amico_example_list_users PRIVATE amico_sdk)

    add_executable(amico_example_get_user examples/get_user_example.cpp)
    target_link_libraries(amico_example_get_user PRIVATE amico_sdk)

    add_executable(amico_example_list_access_logs examples/list_access_logs_example.cpp)
    target_link_libraries(amico_example_list_access_logs PRIVATE amico_sdk)

    add_executable(amico_example_logout examples/logout_example.cpp)
    target_link_libraries(amico_example_logout PRIVATE amico_sdk)
endif()
